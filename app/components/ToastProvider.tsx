"use client";

import { ToastContainer } from "react-toastify";
import "react-toastify/ReactToastify.css";

export function ToastProvider() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={4000}
      newestOnTop
      pauseOnHover
      theme="light"
    />
  );
}
