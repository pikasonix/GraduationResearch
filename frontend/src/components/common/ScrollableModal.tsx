import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * ScrollableModal props
 */
export interface ScrollableModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Function called when the modal is closed */
  onOpenChange: (open: boolean) => void;
  /** Modal title */
  title: React.ReactNode;
  /** Modal content */
  children: React.ReactNode;
  /** Modal footer */
  footer?: React.ReactNode;
  /** Maximum width of the modal (defaults to "sm:max-w-2xl") */
  maxWidth?: string;
  /** Maximum height of the content area */
  maxContentHeight?: string;
}

/**
 * A reusable modal component with fixed header/footer and scrollable content area.
 */
const ScrollableModal: React.FC<ScrollableModalProps> = ({
  open,
  onOpenChange,
  title,
  children,
  footer,
  maxWidth = "sm:max-w-2xl",
  maxContentHeight = "max-h-[calc(80vh-10rem)]",
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`flex flex-col ${maxWidth}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className={`overflow-y-auto ${maxContentHeight} -mr-6`}>
          <div className="pr-6 py-4">{children}</div>
        </div>

        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
};

export default ScrollableModal;
