import { createPortal } from 'react-dom'

/**
 * Render popups on document.body so position:fixed always means the phone screen —
 * never a scrolled/transformed page ancestor (which forces users to scroll up).
 */
export default function ModalPortal({ children }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
