import { useRef } from 'react';
import { useFeedback } from './context';
import { FeedbackForm } from './form';

export function FeedbackModal() {
  const { isOpen, close, config } = useFeedback();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const modalZIndex = config.ui?.zIndex ?? 10_000;

  const prevIsOpen = useRef(isOpen);
  if (prevIsOpen.current !== isOpen) {
    prevIsOpen.current = isOpen;
    if (isOpen) {
      queueMicrotask(() => dialogRef.current?.showModal());
    } else {
      queueMicrotask(() => dialogRef.current?.close());
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={close}
      data-feedback-ui
      style={{ zIndex: modalZIndex }}
      className="fixed inset-0 m-auto w-full max-w-md rounded-xl border border-tw-border bg-tw-surface p-6 text-tw-text-primary shadow-2xl backdrop:bg-tw-bg/50"
    >
      <FeedbackForm />
    </dialog>
  );
}
