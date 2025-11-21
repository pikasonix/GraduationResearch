/**
 * Redux provider component
 */
"use client";

import { Provider } from "react-redux";
import { store } from "./store";
import { ReactNode } from "react";

/**
 * ReduxProvider props interface
 */
interface ReduxProviderProps {
  children: ReactNode;
}

/**
 * Redux provider component to wrap the application
 */
export function ReduxProvider({ children }: ReduxProviderProps) {
  return <Provider store={store}>{children}</Provider>;
}
