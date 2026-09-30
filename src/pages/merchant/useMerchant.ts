import { useApp } from '../../state/store';

/** Current merchant, their UI state and profile. Only used on pages shown after sign-in. */
export function useMerchant() {
  const s = useApp();
  const uid = s.merchant!;
  const u = s.users[uid];
  const profile = s.profiles.find((p) => p.id === uid)!;
  return { s, uid, u, profile };
}
