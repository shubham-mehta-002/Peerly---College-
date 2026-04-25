import type { Namespace } from 'socket.io';

let communityNs: Namespace | null = null;
export function setCommunityNs(ns: Namespace): void { communityNs = ns; }
export function getCommunityNs(): Namespace | null { return communityNs; }
