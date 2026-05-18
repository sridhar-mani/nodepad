"use client"

import { motion, AnimatePresence } from "framer-motion"

interface PanelBackdropProps {
  visible: boolean
  onClose: () => void
  zIndex?: number
}

export function PanelBackdrop({ visible, onClose, zIndex }: PanelBackdropProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          aria-label="Close panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-background/55 backdrop-blur-[2px] lg:hidden z-backdrop"
          style={zIndex != null ? { zIndex } : undefined}
          onClick={onClose}
        />
      )}
    </AnimatePresence>
  )
}
