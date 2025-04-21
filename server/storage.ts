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
  updateExpense(id: string, data: Partial<InsertExpense>): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  
  // Memo methods
  updateEventMemo(eventId: string, memo: string, editorName: string): Promise<Event>;
  acquireEditLock(eventId: string, userName: string): Promise<boolean>;
  releaseEditLock(eventId: string, userName: string): Promise<boolean>;
  
  // Utility methods
  getEventParticipants(eventId: string): Promise<string[]>;
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
  
  async updateEvent(id: string, data: Partial<InsertEvent> & { participants?: string[] }): Promise<Event> {
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
  async createExpense(expense: InsertExpense & { id: string, isSharedWithAll?: boolean }): Promise<Expense & { isSharedWithAll?: boolean }> {
    const newExpense = {
      ...expense,
      participants: expense.participants || [],
      isSharedWithAll: expense.isSharedWithAll || false, // 全員割り勘フラグ
      createdAt: new Date(),
    };
    this.expenses.set(expense.id, newExpense);
    return newExpense;
  }
  
  async getExpense(id: string): Promise<Expense | undefined> {
    return this.expenses.get(id);
  }
  
  async getEventExpenses(eventId: string): Promise<(Expense & { isSharedWithAll?: boolean })[]> {
    return Array.from(this.expenses.values())
      .filter(expense => expense.eventId === eventId);
  }
  
  // 全員割り勘フラグを持つ支出のみを取得
  async getSharedExpenses(eventId: string): Promise<(Expense & { isSharedWithAll?: boolean })[]> {
    return Array.from(this.expenses.values())
      .filter(expense => 
        expense.eventId === eventId && 
        expense.isSharedWithAll === true
      );
  }
  
  async deleteExpense(id: string): Promise<void> {
    this.expenses.delete(id);
  }
  
  async updateExpense(id: string, data: Partial<InsertExpense> & { isSharedWithAll?: boolean }): Promise<Expense & { isSharedWithAll?: boolean }> {
    const expense = this.expenses.get(id);
    if (!expense) throw new Error("Expense not found");
    
    const updatedExpense = {
      ...expense,
      ...data,
    };
    this.expenses.set(id, updatedExpense);
    return updatedExpense;
  }
  
  // Memo methods
  async updateEventMemo(eventId: string, memo: string, editorName: string): Promise<Event> {
    const event = this.events.get(eventId);
    if (!event) throw new Error("Event not found");
    
    // 編集ロックの確認
    if (event.memoEditLock) {
      const lockExpiration = new Date(event.memoEditLock.lockExpiration);
      if (lockExpiration > new Date() && event.memoEditLock.lockedBy !== editorName) {
        throw new Error(`他の参加者（${event.memoEditLock.lockedBy}さん）が現在編集中です`);
      }
    }
    
    // メモを更新
    const updatedEvent = {
      ...event,
      memo,
      memoLastEditedBy: editorName,
      memoLastEditedAt: new Date().toISOString(),
      memoEditLock: null // 編集完了後はロックを解除
    };
    
    this.events.set(eventId, updatedEvent);
    
    // Get date options for this event
    const dateOptions = await this.getEventDateOptions(eventId);
    
    return {
      ...updatedEvent,
      dateOptions,
    };
  }
  
  async acquireEditLock(eventId: string, userName: string): Promise<boolean> {
    const event = this.events.get(eventId);
    if (!event) throw new Error("Event not found");
    
    // 既存のロックを確認
    if (event.memoEditLock) {
      const lockExpiration = new Date(event.memoEditLock.lockExpiration);
      
      // まだロックが有効で、別のユーザーがロックを持っている場合
      if (lockExpiration > new Date() && event.memoEditLock.lockedBy !== userName) {
        return false;
      }
    }
    
    // ロックを設定
    const now = new Date();
    const lockExpiration = new Date(now);
    lockExpiration.setMinutes(lockExpiration.getMinutes() + 5); // 5分間のロック
    
    const updatedEvent = {
      ...event,
      memoEditLock: {
        lockedBy: userName,
        lockedAt: now.toISOString(),
        lockExpiration: lockExpiration.toISOString()
      }
    };
    
    this.events.set(eventId, updatedEvent);
    return true;
  }
  
  async releaseEditLock(eventId: string, userName: string): Promise<boolean> {
    const event = this.events.get(eventId);
    if (!event) throw new Error("Event not found");
    
    // ロックの所有者確認をスキップ（バグ修正）
    // 編集者名を無視して常にロックを解除できるようにする
    
    // ロックを解除
    const updatedEvent = {
      ...event,
      memoEditLock: null
    };
    
    this.events.set(eventId, updatedEvent);
    return true;
  }

  async getEventParticipants(eventId: string): Promise<string[]> {
    // イベントの全参加者を収集
    const event = await this.getEvent(eventId);
    if (!event) throw new Error("Event not found");
    
    // 参加者リストを再計算する前に、既存のリストをマージするために保持
    const existingParticipants = event.participants || [];
    
    // 1. イベント作成者を含む
    const participants = new Set<string>();
    if (event.creatorName) {
      participants.add(event.creatorName);
    }
    
    // 2. 既存の参加者リストを追加
    if (existingParticipants && existingParticipants.length > 0) {
      existingParticipants.forEach(name => participants.add(name));
    }
    
    // 3. 参加者を含む
    const attendances = await this.getEventAttendances(eventId);
    attendances.forEach(attendance => {
      if (attendance.name) {
        participants.add(attendance.name);
      }
    });
    
    // 4. 支払い情報に含まれるすべての参加者を追加
    console.log("経費情報から参加者を集計...");
    const expenses = await this.getEventExpenses(eventId);
    expenses.forEach(expense => {
      if (expense.payerName) {
        participants.add(expense.payerName);
      }
      
      if (expense.participants && expense.participants.length > 0) {
        expense.participants.forEach(name => {
          if (name) participants.add(name);
        });
      }
    });
    
    // 収集した参加者リストをイベントに保存して次回以降使用できるようにする
    const participantsList = Array.from(participants);
    console.log(`経費情報から抽出した参加者数: ${expenses.length}人`);
    console.log(`参加者リスト統合後: ${participantsList.length}人`);
    
    // 参加者リストが変更された場合のみ更新
    const isParticipantsChanged = 
      !existingParticipants.length || 
      participantsList.length !== existingParticipants.length ||
      participantsList.some(p => !existingParticipants.includes(p));
      
    if (isParticipantsChanged) {
      await this.updateEvent(eventId, {
        participants: participantsList
      });
      console.log(`参加者リストを更新しました: ${participantsList.join(', ')}`);
    }
    
    return participantsList;
  }
}

export const storage = new MemStorage();
