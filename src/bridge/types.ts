// Bridge type definitions for Premiere Pro communication

export interface PProMarkerData {
  name: string;
  time: number;
  duration: number;
  color: string;
  guid: string;
  comments: string;
}

export interface BridgeEvents {
  connected: null;
  disconnected: null;
  markersChanged: PProMarkerData[];
  sequenceChanged: string;
}

export type BridgeEventName = keyof BridgeEvents;

export type BridgeEventHandler<K extends BridgeEventName> = (
  data: BridgeEvents[K]
) => void;
