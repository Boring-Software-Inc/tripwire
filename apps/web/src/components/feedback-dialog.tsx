import { useFeedback, FeedbackForm } from "@tripwire/feedback"
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog"

export function FeedbackDialog() {
  const { isOpen, close, config } = useFeedback()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {config.ui?.title ?? "Report an Issue"}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6">
          <FeedbackForm />
        </div>
      </DialogPopup>
    </Dialog>
  )
}
