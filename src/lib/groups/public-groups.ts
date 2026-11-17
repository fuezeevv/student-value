// The eight officially verified group codes explicitly opened for guest browsing.
// This is a public catalog, never membership, enrollment, or authentication.
import { PUBLIC_GROUPS } from "../../../packages/mobile-contracts/src/group-catalog";
export const publicGroups = PUBLIC_GROUPS;
export function publicGroupDefinition(slug: string) {
  return publicGroups.find((group) => group.code.replace("/", "-") === slug);
}
export function browsePath(code: string) {
  return `/browse/${code.replace("/", "-")}`;
}
