import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { nanoid } from "nanoid";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all events
  app.get("/api/events", async (req, res) => {
    const events = await storage.getAllEvents();
    res.json(events);
  });

  // Create a new event
  app.post("/api/events", async (req, res) => {
    try {
      const eventSchema = z.object({
        title: z.string().min(1, "タイトルを入力してください"),
        description: z.string().optional(),
        creatorName: z.string().min(1, "お名前を入力してください"),
        defaultStartTime: z.string().min(1, "デフォルト開始時間を入力してください"),
        defaultEndTime: z.string().min(1, "デフォルト終了時間を入力してください"),
        dateOptions: z.array(z.object({
          date: z.string(), // yyyy-MM-dd format
          startTime: z.string().optional(), // HH:mm format, optional if using default
          endTime: z.string().optional(), // HH:mm format, optional if using default
          useDefaultTime: z.boolean().default(true)
        })).min(1, "少なくとも1つの日程を選択してください"),
      });

      const validatedData = eventSchema.parse(req.body);
      
      // Generate a unique ID for the event
      const eventId = nanoid();
      
      // Create event
      const event = await storage.createEvent({
        id: eventId,
        title: validatedData.title,
        description: validatedData.description || "",
        creatorName: validatedData.creatorName,
        defaultStartTime: validatedData.defaultStartTime,
        defaultEndTime: validatedData.defaultEndTime,
      });
      
      // Create date options
      const dateOptions = await Promise.all(
        validatedData.dateOptions.map(option => {
          // 個別の時間設定がない場合はデフォルト時間を使用
          const startTime = option.useDefaultTime ? validatedData.defaultStartTime : (option.startTime || validatedData.defaultStartTime);
          const endTime = option.useDefaultTime ? validatedData.defaultEndTime : (option.endTime || validatedData.defaultEndTime);
          
          return storage.createDateOption({
            id: nanoid(),
            eventId: eventId,
            date: option.date,
            startTime,
            endTime,
          });
        })
      );
      
      // 参加者を登録（もし指定されていれば）
      let participantCount = 0;
      if (req.body.participants && Array.isArray(req.body.participants)) {
        await Promise.all(
          req.body.participants.map(async (name: string) => {
            const attendanceId = nanoid();
            await storage.createAttendance({
              id: attendanceId,
              eventId,
              name,
            });
            participantCount++;
          })
        );
        
        // 参加者数を更新
        if (participantCount > 0) {
          await storage.updateEvent(eventId, {
            participantsCount: participantCount,
          });
        }
      }
      
      res.status(201).json({ 
        ...event, 
        dateOptions 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "イベントの作成に失敗しました" });
      }
    }
  });

  // Get a single event by ID
  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "イベントの取得に失敗しました" });
    }
  });

  // Finalize an event date
  app.post("/api/events/:id/finalize", async (req, res) => {
    try {
      const schema = z.object({
        dateOptionId: z.string().min(1, "日程を選択してください"),
      });

      const { dateOptionId } = schema.parse(req.body);
      
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      const dateOption = event.dateOptions.find(option => option.id === dateOptionId);
      if (!dateOption) {
        return res.status(404).json({ message: "指定された日程が見つかりません" });
      }
      
      // Update the event with the selected date
      const updatedEvent = await storage.updateEvent(req.params.id, {
        selectedDate: dateOption.date,
        startTime: dateOption.startTime,
        endTime: dateOption.endTime,
      });
      
      res.json(updatedEvent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "日程の確定に失敗しました" });
      }
    }
  });

  // Get all attendances for an event
  app.get("/api/events/:id/attendances", async (req, res) => {
    try {
      const attendances = await storage.getEventAttendances(req.params.id);
      res.json(attendances);
    } catch (error) {
      res.status(500).json({ message: "出欠情報の取得に失敗しました" });
    }
  });

  // Create or update an attendance
  app.post("/api/events/:id/attendances", async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1, "お名前を入力してください"),
        responses: z.array(z.object({
          dateOptionId: z.string(),
          status: z.enum(["available", "maybe", "unavailable"]),
        })).min(1),
      });

      const validatedData = schema.parse(req.body);
      
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      // 既存の出席者リストを取得
      const existingAttendances = await storage.getEventAttendances(req.params.id);
      const existingAttendance = existingAttendances.find(a => a.name === validatedData.name);
      
      let attendance;
      
      if (existingAttendance) {
        // 既存の回答を更新
        await storage.updateAttendanceResponses(existingAttendance.id, validatedData.responses);
        attendance = existingAttendance;
      } else {
        // 新しい出席情報を作成
        const attendanceId = nanoid();
        attendance = await storage.createAttendance({
          id: attendanceId,
          eventId: req.params.id,
          name: validatedData.name,
        });
        
        // Create responses
        await Promise.all(
          validatedData.responses.map(response => 
            storage.createAttendanceResponse({
              attendanceId: attendanceId,
              dateOptionId: response.dateOptionId,
              status: response.status,
            })
          )
        );
        
        // Update participant count
        await storage.updateEvent(req.params.id, {
          participantsCount: (event.participantsCount || 0) + 1,
        });
      }
      
      res.status(201).json(attendance);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "出欠情報の保存に失敗しました" });
      }
    }
  });

  // Get all expenses for an event
  app.get("/api/events/:id/expenses", async (req, res) => {
    try {
      const expenses = await storage.getEventExpenses(req.params.id);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ message: "支払い情報の取得に失敗しました" });
    }
  });

  // Create a new expense
  app.post("/api/events/:id/expenses", async (req, res) => {
    try {
      const schema = z.object({
        payerName: z.string().min(1, "支払者名を入力してください"),
        description: z.string().min(1, "項目を入力してください"),
        amount: z.number().positive("金額は0より大きい値を入力してください"),
        participants: z.array(z.string()).default([]), // 割り勘対象者の配列（指定がない場合は空配列）
      });

      const validatedData = schema.parse(req.body);
      
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      if (!event.selectedDate) {
        return res.status(400).json({ message: "イベントの日程が確定していないため、精算機能は利用できません" });
      }
      
      const expense = await storage.createExpense({
        id: nanoid(),
        eventId: req.params.id,
        payerName: validatedData.payerName,
        description: validatedData.description,
        amount: String(validatedData.amount),
        participants: validatedData.participants,
      });
      
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "支払い情報の保存に失敗しました" });
      }
    }
  });

  // Delete an expense
  app.delete("/api/events/:eventId/expenses/:expenseId", async (req, res) => {
    try {
      const { eventId, expenseId } = req.params;
      
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      await storage.deleteExpense(expenseId);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "支払い情報の削除に失敗しました" });
    }
  });

  // Get settlements for an event
  app.get("/api/events/:id/settlements", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      if (!event.selectedDate) {
        return res.status(400).json({ message: "イベントの日程が確定していないため、精算機能は利用できません" });
      }
      
      const expenses = await storage.getEventExpenses(req.params.id);
      const settlements = calculateSettlements(expenses);
      
      res.json(settlements);
    } catch (error) {
      res.status(500).json({ message: "精算情報の計算に失敗しました" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function calculateSettlements(expenses: any[]): { from: string; to: string; amount: number }[] {
  if (!expenses.length) return [];
  
  // すべての参加者を集める
  const allParticipants = new Set<string>();
  
  // まずは全ての支払者と全ての参加者を集める
  expenses.forEach(expense => {
    // 支払者を追加
    allParticipants.add(expense.payerName);
    
    // 参加者が指定されている場合は参加者リストに追加
    if (expense.participants && expense.participants.length > 0) {
      expense.participants.forEach((p: string) => allParticipants.add(p));
    }
  });
  
  // 各参加者の支払合計額と負担額を計算するオブジェクト
  const participantTotals: { 
    [key: string]: { 
      paid: number;      // 支払った合計額
      shouldPay: number; // 負担すべき合計額 
    } 
  } = {};
  
  // 全ての参加者の支払いと負担額を0で初期化
  Array.from(allParticipants).forEach(person => {
    participantTotals[person] = { paid: 0, shouldPay: 0 };
  });
  
  // 各支出について、支払額と負担額を計算
  expenses.forEach(expense => {
    const amount = Math.round(Number(expense.amount)); // 金額を整数に
    const payerName = expense.payerName;
    
    // 支払者の支払い合計に加算
    participantTotals[payerName].paid += amount;
    
    // 指定された参加者間で分割する
    let splitParticipants: string[] = [];
    
    // 参加者が指定されている場合はその参加者で分割
    if (expense.participants && expense.participants.length > 0) {
      splitParticipants = expense.participants;
    } else {
      // 参加者が指定されていない場合は、全員で分割
      splitParticipants = Array.from(allParticipants);
    }
    
    // 各参加者の負担額を計算（小数点以下を四捨五入）
    // 端数処理のため合計を取る
    let totalSplit = 0;
    const perPersonAmount = Math.floor(amount / splitParticipants.length);
    
    // まずは普通に割り当て
    splitParticipants.forEach(person => {
      participantTotals[person].shouldPay += perPersonAmount;
      totalSplit += perPersonAmount;
    });
    
    // 端数の処理（1円ずつ割り当て）
    const remainder = amount - totalSplit;
    for (let i = 0; i < remainder; i++) {
      if (i < splitParticipants.length) {
        participantTotals[splitParticipants[i]].shouldPay += 1;
      }
    }
  });
  
  // Generate settlements
  const settlements: { from: string; to: string; amount: number }[] = [];
  
  // 精算額の計算: 誰が誰にいくら払うべきか
  // 各参加者の差額を計算 (paid - shouldPay)
  const balances: { [key: string]: number } = {};
  
  Object.entries(participantTotals).forEach(([person, totals]) => {
    balances[person] = totals.paid - totals.shouldPay;
    
    // デバッグログ（必要に応じてコメントアウト）
    // console.log(`${person}: 支払額=${totals.paid}円, 負担額=${totals.shouldPay}円, 差額=${balances[person]}円`);
  });
  
  // 支払う側（残高がマイナス）と受け取る側（残高がプラス）に分ける
  const payers: { name: string; amount: number }[] = [];
  const receivers: { name: string; amount: number }[] = [];
  
  Object.entries(balances).forEach(([person, balance]) => {
    if (balance < -0.01) {
      // 負の残高 -> 支払う側
      payers.push({ name: person, amount: -balance });
    } else if (balance > 0.01) {
      // 正の残高 -> 受け取る側
      receivers.push({ name: person, amount: balance });
    }
  });
  
  // 最適化ステップ1: 支払者を少額順に並べることで、早く清算を完了する人を優先
  // Sort by amount (descending for receivers, ascending for payers)
  payers.sort((a, b) => a.amount - b.amount);
  receivers.sort((a, b) => b.amount - a.amount);
  
  // 最適化ステップ2: まずは直接支払いを生成
  const directSettlements: { from: string; to: string; amount: number }[] = [];
  
  // Match payers with receivers for direct settlements
  const tempPayers = [...payers];
  const tempReceivers = [...receivers];
  
  while (tempPayers.length > 0 && tempReceivers.length > 0) {
    const payer = tempPayers[0];
    const receiver = tempReceivers[0];
    
    const amount = Math.min(payer.amount, receiver.amount);
    
    if (amount > 0) {
      directSettlements.push({
        from: payer.name,
        to: receiver.name,
        amount: Math.round(amount), // 小数点以下を四捨五入
      });
    }
    
    payer.amount -= amount;
    receiver.amount -= amount;
    
    if (payer.amount < 0.01) tempPayers.shift();
    if (receiver.amount < 0.01) tempReceivers.shift();
  }
  
  // 最適化ステップ3: 支払いネットワークを最適化して、取引回数を減らす
  if (directSettlements.length <= 2) {
    // 支払い回数が少ない場合は最適化の必要がないのでそのまま返す
    return directSettlements;
  }
  
  // 支払いグラフを構築
  const graph: { [key: string]: { [key: string]: number } } = {};
  
  // グラフの初期化
  const graphParticipants = new Set<string>();
  directSettlements.forEach(s => {
    graphParticipants.add(s.from);
    graphParticipants.add(s.to);
  });
  
  Array.from(graphParticipants).forEach(person => {
    graph[person] = {};
  });
  
  // 直接支払いをグラフにマッピング
  directSettlements.forEach(s => {
    graph[s.from][s.to] = (graph[s.from][s.to] || 0) + s.amount;
  });
  
  // フロイド-ワーシャルアルゴリズムを使用して、間接支払いの可能性を見つける
  Array.from(graphParticipants).forEach(k => {
    Array.from(graphParticipants).forEach(i => {
      if (i !== k) {
        Array.from(graphParticipants).forEach(j => {
          if (j !== i && j !== k && 
              graph[i][k] !== undefined && 
              graph[k][j] !== undefined) {
            // i -> k -> j の間接経路が存在する場合
            const throughK = Math.min(graph[i][k], graph[k][j]);
            
            // i -> j への直接経路があれば更新、なければ作成
            if (graph[i][j] === undefined) {
              graph[i][j] = 0;
            }
            
            graph[i][j] += throughK;
            graph[i][k] -= throughK;
            graph[k][j] -= throughK;
            
            // 0になった経路を削除
            if (Math.abs(graph[i][k]) < 0.01) delete graph[i][k];
            if (Math.abs(graph[k][j]) < 0.01) delete graph[k][j];
          }
        });
      }
    });
  });
  
  // 最適化されたグラフから精算リストを構築
  Object.entries(graph).forEach(([from, toMap]) => {
    Object.entries(toMap).forEach(([to, amount]) => {
      if (amount > 0.01) {
        settlements.push({
          from,
          to,
          amount: Math.round(amount), // 小数点以下を四捨五入
        });
      }
    });
  });
  
  // もし最適化によって支払いが増えた場合は、元の直接支払いを使用
  return settlements.length < directSettlements.length ? settlements : directSettlements;
}
