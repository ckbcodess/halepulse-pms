import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode; // action buttons go here
}

export default function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col items-start gap-4 mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      {/* Left: title + subtitle */}
      <div className="flex min-w-0 flex-col gap-3">
        <h1 className="text-2xl sm:text-[26px] font-medium text-foreground tracking-[-0.05px] leading-tight sm:leading-none">
          {title}
        </h1>
        {description && (
          <p className="text-[15px] sm:text-[16px] font-medium text-muted-foreground leading-[20px]">
            {description}
          </p>
        )}
      </div>

      {/* Right: actions */}
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-[7px]">
          {children}
        </div>
      )}
    </div>
  );
}
