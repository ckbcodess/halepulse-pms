'use client';
import { useHeartbeat } from '@/hooks/useHeartbeat';

export default function HeartbeatProvider({ children }: { children: React.ReactNode }) {
  useHeartbeat();
  return <>{children}</>;
}
