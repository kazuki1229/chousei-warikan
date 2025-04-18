import { 
  InsertEvent, 
  InsertDateOption, 
  InsertAttendance, 
  InsertAttendanceResponse, 
  InsertExpense,
  Event,
  DateOption,
  Attendance,
  Expense,
} from "@shared/schema";

export interface IStorage {
  // Event methods
  createEvent(event: InsertEvent & { id: string }): Promise<Event>;
  getEvent(id: string): Promise<Event | undefined>;
  getAllEvents(): Promise<Event[]>;
  updateEvent(id: string, data: Partial<InsertEvent>): Promise<Event>;
  
  // DateOption methods
  createDateOption(dateOption: InsertDateOption & { id: string }): Promise<DateOption>;
  getDateOption(id: string): Promise<DateOption | undefined>;
  getEventDateOptions(eventId: string): Promise<DateOption[]>;
  
  // Attendance methods
  createAttendance(attendance: InsertAttendance & { id: string }): Promise<Attendance>;
  getAttendance(id: string): Promise<Attendance | undefined>;
  getAttendanceByEmail(eventId: string, email: string): Promise<Attendance | undefined>;
  getEventAttendances(eventId: string): Promise<Attendance[]>;
  
  // AttendanceResponse methods
  createAttendanceResponse(response: InsertAttendanceResponse): Promise<any>;
  updateAttendanceResponses(attendanceId: string, responses: { dateOptionId: string, status: string }[]): Promise<void>;
  getAttendanceResponses(attendanceId: string): Promise<any[]>;
  
  // Expense methods
  createExpense(expense: InsertExpense & { id: string }): Promise<Expense>;
  getExpense(id: string): Promise<Expense | undefined>;
  getEventExpenses(eventId: string): Promise<Expense[]>;
  deleteExpense(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private events: Map<string, any>;
  private dateOptions: Map<string, any>;
  private attendances: Map<string, any>;
  private attendanceResponses: Map<string, any[]>;
  private expenses: Map<string, any>;
  
  constructor() {
    this.events = new Map();
    this.dateOptions = new Map();
    this.attendances = new Map();
    this.attendanceResponses = new Map();
    this.expenses = new Map();
  }
  
  // Event methods
  async createEvent(event: InsertEvent & { id: string }): Promise<Event> {
    const newEvent = {
      ...event,
      description: event.description || null,
      selectedDate: event.selectedDate || null,
      startTime: event.startTime || null,
      endTime: event.endTime || null,
      defaultStartTime: event.defaultStartTime || null,
      defaultEndTime: event.defaultEndTime || null,
      createdAt: new Date(),
      participantsCount: 0,
      dateOptions: [],
    };
    this.events.set(event.id, newEvent);
    return newEvent;
  }
  
  async getEvent(id: string): Promise<Event | undefined> {
    const event = this.events.get(id);
    if (!event) return undefined;
    
    // Get date options for this event
    const dateOptions = await this.getEventDateOptions(id);
    
    return {
      ...event,
      dateOptions,
    };
  }
  
  async getAllEvents(): Promise<Event[]> {
    return Promise.all(
      Array.from(this.events.keys()).map(id => this.getEvent(id))
    ) as Promise<Event[]>;
  }
  
  async updateEvent(id: string, data: Partial<InsertEvent>): Promise<Event> {
    const event = this.events.get(id);
    if (!event) throw new Error("Event not found");
    
    const updatedEvent = {
      ...event,
      ...data,
    };
    this.events.set(id, updatedEvent);
    
    // Get date options for this event
    const dateOptions = await this.getEventDateOptions(id);
    
    return {
      ...updatedEvent,
      dateOptions,
    };
  }
  
  // DateOption methods
  async createDateOption(dateOption: InsertDateOption & { id: string }): Promise<DateOption> {
    this.dateOptions.set(dateOption.id, dateOption);
    return dateOption;
  }
  
  async getDateOption(id: string): Promise<DateOption | undefined> {
    return this.dateOptions.get(id);
  }
  
  async getEventDateOptions(eventId: string): Promise<DateOption[]> {
    return Array.from(this.dateOptions.values())
      .filter(option => option.eventId === eventId);
  }
  
  // Attendance methods
  async createAttendance(attendance: InsertAttendance & { id: string }): Promise<Attendance> {
    const newAttendance = {
      ...attendance,
      createdAt: new Date(),
      responses: [],
    };
    this.attendances.set(attendance.id, newAttendance);
    this.attendanceResponses.set(attendance.id, []);
    return newAttendance;
  }
  
  async getAttendance(id: string): Promise<Attendance | undefined> {
    const attendance = this.attendances.get(id);
    if (!attendance) return undefined;
    
    // Get responses for this attendance
    const responses = await this.getAttendanceResponses(id);
    
    return {
      ...attendance,
      responses,
    };
  }
  
  async getAttendanceByEmail(eventId: string, email: string): Promise<Attendance | undefined> {
    // メールアドレスを使用しなくなったため、この関数は常にundefinedを返す
    return undefined;
  }
  
  async getEventAttendances(eventId: string): Promise<Attendance[]> {
    const attendances = Array.from(this.attendances.values())
      .filter(attendance => attendance.eventId === eventId);
    
    return Promise.all(
      attendances.map(attendance => this.getAttendance(attendance.id))
    ) as Promise<Attendance[]>;
  }
  
  // AttendanceResponse methods
  async createAttendanceResponse(response: InsertAttendanceResponse): Promise<any> {
    const responses = this.attendanceResponses.get(response.attendanceId) || [];
    
    // Generate an ID for the response
    const newResponse = {
      ...response,
      id: responses.length + 1,
    };
    
    responses.push(newResponse);
    this.attendanceResponses.set(response.attendanceId, responses);
    
    return newResponse;
  }
  
  async updateAttendanceResponses(attendanceId: string, responses: { dateOptionId: string, status: string }[]): Promise<void> {
    const currentResponses = this.attendanceResponses.get(attendanceId) || [];
    
    // Update existing responses or create new ones
    const updatedResponses = responses.map(resp => {
      const existing = currentResponses.find(r => r.dateOptionId === resp.dateOptionId);
      if (existing) {
        return {
          ...existing,
          status: resp.status,
        };
      } else {
        return {
          id: currentResponses.length + 1,
          attendanceId,
          dateOptionId: resp.dateOptionId,
          status: resp.status,
        };
      }
    });
    
    this.attendanceResponses.set(attendanceId, updatedResponses);
  }
  
  async getAttendanceResponses(attendanceId: string): Promise<any[]> {
    return this.attendanceResponses.get(attendanceId) || [];
  }
  
  // Expense methods
  async createExpense(expense: InsertExpense & { id: string }): Promise<Expense> {
    const newExpense = {
      ...expense,
      createdAt: new Date(),
    };
    this.expenses.set(expense.id, newExpense);
    return newExpense;
  }
  
  async getExpense(id: string): Promise<Expense | undefined> {
    return this.expenses.get(id);
  }
  
  async getEventExpenses(eventId: string): Promise<Expense[]> {
    return Array.from(this.expenses.values())
      .filter(expense => expense.eventId === eventId);
  }
  
  async deleteExpense(id: string): Promise<void> {
    this.expenses.delete(id);
  }
}

export const storage = new MemStorage();
