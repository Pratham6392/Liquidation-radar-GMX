import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
}

const paddingMap = {
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

export function Card({ children, className = "", padding = "md" }: CardProps) {
  return (
    <div className={`card shadow-card ${paddingMap[padding]} ${className}`}>
      {children}
    </div>
  );
}
