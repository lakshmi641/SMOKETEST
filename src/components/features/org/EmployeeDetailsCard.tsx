import React from 'react'
import { X } from 'lucide-react'

interface EmployeeDetailsCardProps {
  employees: Array<{
    id: string
    name: string
    position: string
    positionName?: string
    department?: string
    avatar?: string
    imageUrl?: string
    phone?: string
    email?: string
    location?: string
    description?: string
    team?: string
    parentId?: string | null
    level: number
    userId?: string
    isVacant: boolean
    assignment?: any
    positionData?: any
    userData?: any
    designation?: string
    positionCode?: string
  }>
  employee: {
    id: string
    name: string
    position: string
    positionCode?: string
    positionName?: string
    department?: string
    departmentData?: { parentOrgUnitId: string | null }
    avatar?: string
    imageUrl?: string
    phone?: string
    email?: string
    location?: string
    description?: string
    team?: string
    parentId?: string | null
    level: number
    userId?: string
    isVacant: boolean
    assignment?: any
    positionData?: any
    userData?: any
    designation?: string
    reportsTo?: string | null
    reportsToName?: string | null
    parentOrgUnit?: string | null
  }
  handleClose: () => void
}

const EmployeeDetailsCard: React.FC<EmployeeDetailsCardProps> = ({
  employees,
  employee,
  handleClose,
}) => {
  const imageUrl = employee.avatar || ''
  const positionName = employee.position || ''
  const team = employee.team || ''

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
        <button
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          onClick={handleClose}
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>

        {team === '' ? (
          <div className="p-6">
            <div className="card-header flex items-center gap-4 mb-6">
              {imageUrl ? (
                <img
                  className="w-20 h-20 rounded-full object-cover"
                  src={imageUrl}
                  alt="Profile"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold">
                  {employee.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">{employee.name}</h2>
                {employee.email && (
                  <p className="text-sm text-gray-500 mt-1">{employee.email}</p>
                )}
                <div className="flex flex-col gap-0.5 mt-1">
                  <p className="text-gray-900 font-medium">{employee.designation || positionName}</p>
                  <p className="text-gray-500 text-sm">{positionName}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {employee.positionCode && (
                    <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-100 text-slate-600 border border-slate-200">
                      {employee.positionCode}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="card-body space-y-3">
              {employee.phone && (
                <div className="card-item">
                  <p className="card-item-label text-xs font-medium text-gray-500 mb-1">Phone:</p>
                  <p className="card-item-value text-base font-semibold text-gray-900">{employee.phone}</p>
                </div>
              )}

              {employee.location && (
                <div className="card-item">
                  <p className="card-item-label text-xs font-medium text-gray-500 mb-1">Location:</p>
                  <p className="card-item-value text-base font-semibold text-gray-900">{employee.location}</p>
                </div>
              )}

              {employee.reportsTo && (
                <div className="card-item">
                  <p className="card-item-label text-xs font-medium text-gray-500 mb-1">Reports To:</p>
                  <div>
                    {employee.reportsToName && (
                      <p className="card-item-value text-base font-semibold text-gray-900">{employee.reportsToName}</p>
                    )}
                    <p className="card-item-value text-base font-semibold text-gray-900">{employee.reportsTo}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="card-header mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">{team} Team</h2>
            </div>
            <h4 className="text-lg font-medium text-gray-700 mb-4">Team Members:</h4>
            <div className="card-body space-y-3">
              {employees
                .filter((emp) => emp.parentId === employee.id)
                .map((emp) => (
                  <div
                    className="card-item-team flex items-center gap-3 p-3 border border-gray-200 rounded-lg"
                    key={emp.id}
                  >
                    {emp.avatar ? (
                      <img
                        className="w-12 h-12 rounded-full object-cover"
                        src={emp.avatar}
                        alt="Profile"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="card-item-name font-semibold text-gray-900">{emp.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="card-item-role text-sm text-gray-600">{emp.position}</p>
                        {emp.positionCode && (
                          <span className="px-1 py-0.5 text-[9px] font-mono font-bold rounded bg-slate-50 text-slate-500 border border-slate-100">
                            {emp.positionCode}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {employee.description && (
          <div className="p-6 border-t border-gray-200">
            <div className="card-item">
              <p className="card-item-label text-sm font-medium text-gray-600 mb-2">
                Description:
              </p>
              <p className="card-item-value text-sm text-gray-900">{employee.description}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EmployeeDetailsCard
