import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.jsx";

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (clerkKey) {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <ClerkProvider publishableKey={clerkKey}>
      <App />
    </ClerkProvider>
  );
} else {
  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
}
