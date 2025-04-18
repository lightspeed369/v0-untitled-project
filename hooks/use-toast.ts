"use client"

import type React from "react"

// This is a replacement for the original use-toast.tsx file
// It's been rewritten to avoid any experimental React features

import { useState, useEffect } from "react"

type ToastProps = {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ToastState = {
  toasts: ToastProps[]
}

type ToastOptions = Omit<ToastProps, "id" | "open" | "onOpenChange">

let count = 0
const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

function genId() {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

// In-memory state
let memoryState: ToastState = { toasts: [] }
const listeners: Array<(state: ToastState) => void> = []

// Action types
const ADD_TOAST = "ADD_TOAST"
const UPDATE_TOAST = "UPDATE_TOAST"
const DISMISS_TOAST = "DISMISS_TOAST"
const REMOVE_TOAST = "REMOVE_TOAST"

type Action =
  | { type: typeof ADD_TOAST; toast: ToastProps }
  | { type: typeof UPDATE_TOAST; toast: Partial<ToastProps> }
  | { type: typeof DISMISS_TOAST; toastId?: string }
  | { type: typeof REMOVE_TOAST; toastId?: string }

// Timeout map
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: REMOVE_TOAST,
      toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

// Reducer function
function reducer(state: ToastState, action: Action): ToastState {
  switch (action.type) {
    case ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      }

    case DISMISS_TOAST: {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      }
    }
    case REMOVE_TOAST:
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

// Dispatch function
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

// Toast function
function toast(props: ToastOptions) {
  const id = genId()

  const update = (props: Partial<ToastProps>) =>
    dispatch({
      type: UPDATE_TOAST,
      toast: { ...props, id },
    })

  const dismiss = () => dispatch({ type: DISMISS_TOAST, toastId: id })

  dispatch({
    type: ADD_TOAST,
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id,
    dismiss,
    update,
  }
}

// Hook
export function useToast() {
  const [state, setState] = useState<ToastState>(memoryState)

  useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: DISMISS_TOAST, toastId }),
  }
}

export { toast }
