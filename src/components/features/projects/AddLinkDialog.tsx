import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Link as LinkIcon } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface AddLinkDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onAddLink: (name: string, url: string) => Promise<void>
}

export function AddLinkDialog({ open, onOpenChange, onAddLink }: AddLinkDialogProps) {
    const [name, setName] = useState('')
    const [url, setUrl] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!name.trim() || !url.trim()) {
            toast.error('Please fill in all fields')
            return
        }

        try {
            // Basic URL validation
            let formattedUrl = url.trim()
            if (!/^https?:\/\//i.test(formattedUrl)) {
                formattedUrl = 'https://' + formattedUrl
            }

            try {
                new URL(formattedUrl)
            } catch (e) {
                toast.error('Please enter a valid URL')
                return
            }

            setIsLoading(true)
            await onAddLink(name.trim(), formattedUrl)
            handleClose()
        } catch (error) {
            console.error('Error adding link:', error)
            toast.error('Failed to add link')
        } finally {
            setIsLoading(false)
        }
    }

    const handleClose = () => {
        setName('')
        setUrl('')
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={(val) => !isLoading && handleClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Link</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Link Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g., Design Guidelines"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="url">URL</Label>
                        <div className="relative">
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                id="url"
                                placeholder="e.g., www.figma.com/..."
                                className="pl-9"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading} className="bg-primary">
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                'Add Link'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
