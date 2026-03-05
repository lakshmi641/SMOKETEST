'use client'

import { useState, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { TrendingUp, DollarSign, ShoppingCart, Users, Package, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface SalesSummary {
  totalSales: number
  totalTransactions: number
  averageTransaction: number
  totalTax: number
  totalDiscount: number
}

interface SalesByDate {
  date: string
  totalSales: number
  transactionCount: number
}

interface SalesByCustomer {
  customerName: string
  customerCode: string
  totalSales: number
  transactionCount: number
}

interface SalesByProduct {
  productName: string
  productCode: string
  totalSales: number
  totalQuantity: number
  transactionCount: number
}

export default function SalesReportPage() {
  const { companyId } = useCompany()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [salesByDate, setSalesByDate] = useState<SalesByDate[]>([])
  const [salesByCustomer, setSalesByCustomer] = useState<SalesByCustomer[]>([])
  const [salesByProduct, setSalesByProduct] = useState<SalesByProduct[]>([])
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  })

  const loadSalesData = async () => {
    if (!companyId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Load summary
      const summaryResponse = await fetch(
        `/api/sales/report?companyId=${companyId}&type=summary&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      )
      const summaryData = await summaryResponse.json()
      if (summaryData.success) {
        setSummary(summaryData.data)
      }

      // Load sales by date
      const byDateResponse = await fetch(
        `/api/sales/report?companyId=${companyId}&type=byDate&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      )
      const byDateData = await byDateResponse.json()
      if (byDateData.success) {
        setSalesByDate(byDateData.data)
      }

      // Load top customers
      const byCustomerResponse = await fetch(
        `/api/sales/report?companyId=${companyId}&type=byCustomer&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&limit=10`
      )
      const byCustomerData = await byCustomerResponse.json()
      if (byCustomerData.success) {
        setSalesByCustomer(byCustomerData.data)
      }

      // Load top products
      const byProductResponse = await fetch(
        `/api/sales/report?companyId=${companyId}&type=byProduct&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&limit=10`
      )
      const byProductData = await byProductResponse.json()
      if (byProductData.success) {
        setSalesByProduct(byProductData.data)
      }
    } catch (error) {
      console.error('Error loading sales data:', error)
      toast.error('Failed to load sales data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSalesData()
  }, [companyId, dateRange])

  const handleDateRangeChange = (field: 'startDate' | 'endDate', value: string) => {
    setDateRange((prev) => ({ ...prev, [field]: value }))
  }

  // Chart data for sales trend
  const salesTrendData = {
    labels: salesByDate.map((item) => format(new Date(item.date), 'MMM dd')),
    datasets: [
      {
        label: 'Daily Sales',
        data: salesByDate.map((item) => item.totalSales),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  }

  // Chart data for top customers
  const topCustomersData = {
    labels: salesByCustomer.slice(0, 5).map((item) => item.customerName || 'Unknown'),
    datasets: [
      {
        label: 'Sales Amount',
        data: salesByCustomer.slice(0, 5).map((item) => item.totalSales),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
        ],
      },
    ],
  }

  // Chart data for top products
  const topProductsData = {
    labels: salesByProduct.slice(0, 5).map((item) => item.productName || 'Unknown'),
    datasets: [
      {
        label: 'Sales Amount',
        data: salesByProduct.slice(0, 5).map((item) => item.totalSales),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
        ],
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      },
    },
  }

  if (!companyId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Please select a company to view sales reports.</p>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-gray-600 mt-1">Analytics and insights from your sales data</p>
        </div>
        <div className="flex gap-4">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <span className="self-center text-gray-500">to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Sales</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ₹{(summary?.totalSales ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Transactions</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {(summary?.totalTransactions ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <ShoppingCart className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Transaction</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ₹{(summary?.averageTransaction ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tax</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ₹{(summary?.totalTax ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Trend */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend</h2>
              <div className="h-64">
                {salesByDate.length > 0 ? (
                  <Line data={salesTrendData} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No data available
                  </div>
                )}
              </div>
            </div>

            {/* Top Customers */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Customers</h2>
              <div className="h-64">
                {salesByCustomer.length > 0 ? (
                  <Bar data={topCustomersData} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Products</h2>
            <div className="h-64">
              {salesByProduct.length > 0 ? (
                <Doughnut data={topProductsData} options={chartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Customers Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Customers</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sales
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transactions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {salesByCustomer.length > 0 ? (
                      salesByCustomer.map((customer, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {customer.customerName || 'Unknown'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            ₹{(customer.totalSales ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {customer.transactionCount ?? 0}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Products Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Products</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sales
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {salesByProduct.length > 0 ? (
                      salesByProduct.map((product, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {product.productName || 'Unknown'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            ₹{(product.totalSales ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {(product.totalQuantity ?? 0).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </DashboardLayout>
  )
}

