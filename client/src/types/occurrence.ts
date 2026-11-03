export interface RescheduleRoomOption {
  _id: string;
  name: string;
  building: string;
  capacity: number;
  type: string;
}

export interface RescheduleOption {
  period: number;
  durationSlots: number;
  startTime: string;
  endTime: string;
  availableRooms: RescheduleRoomOption[];
  suggestedRoom: RescheduleRoomOption | null;
}

export interface RescheduleOptionsResponse {
  targetDate: string;
  durationSlots: number;
  options: RescheduleOption[];
}
