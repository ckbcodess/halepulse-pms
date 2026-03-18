import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode; // action buttons go here
}

export default function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-6 mb-8">
      {/* Left: title + subtitle */}
      <div className="flex flex-col gap-3 shrink-0">
        <h1 className="text-[32px] font-medium text-foreground tracking-[-0.05px] leading-none">
          {title}
        </h1>
        {description && (
          <p className="text-[16px] font-medium text-muted-foreground leading-[20px]">
            {description}
          </p>
        )}
      </div>

      {/* Right: actions */}
      {children && (
        <div className="flex items-center gap-[7px] shrink-0">
          {children}
        </div>
      )}
    </div>
  );
}
