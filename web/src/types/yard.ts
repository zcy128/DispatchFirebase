export interface Yard {
  id: string;
  yardId: number;
  name: string;
  supervisorId?: string;
  supervisorName?: string;
  supervisorPhone?: string;
  supervisorEmail?: string;
  supervisorAltId?: string;
  supervisorAltName?: string;
  supervisorAltPhone?: string;
  supervisorAltEmail?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface YardStats {
  totalYards: number;
  activeYards: number;
}

export interface CreateYardInput {
  name: string;
  supervisorId?: string;
  supervisorName?: string;
  supervisorPhone?: string;
  supervisorEmail?: string;
  supervisorAltId?: string;
  supervisorAltName?: string;
  supervisorAltPhone?: string;
  supervisorAltEmail?: string;
  isActive?: boolean;
}

export interface UpdateYardInput {
  name?: string;
  supervisorId?: string;
  supervisorName?: string;
  supervisorPhone?: string;
  supervisorEmail?: string;
  supervisorAltId?: string;
  supervisorAltName?: string;
  supervisorAltPhone?: string;
  supervisorAltEmail?: string;
  isActive?: boolean;
}
