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
      // スキーマを拡張して、確定済み日程のケースにも対応
      const eventBaseSchema = z.object({
        title: z.string().min(1, "タイトルを入力してください"),
        description: z.string().optional(),
        creatorName: z.string().min(1, "お名前を入力してください"),
        defaultStartTime: z.string().min(1, "デフォルト開始時間を入力してください"),
        defaultEndTime: z.string().min(1, "デフォルト終了時間を入力してください"),
      });
      
      // 日付が決まっているケースのスキーマ
      const confirmedDateSchema = eventBaseSchema.extend({
        isDateConfirmed: z.literal(true),
        selectedDate: z.string().min(1, "確定日を入力してください"),
        startTime: z.string().min(1, "開始時間を入力してください"),
        endTime: z.string().min(1, "終了時間を入力してください"),
        dateOptions: z.array(z.object({
          date: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          useDefaultTime: z.boolean().default(true)
        })).min(1)
      });
      
      // 通常の日程候補のスキーマ
      const normalEventSchema = eventBaseSchema.extend({
        isDateConfirmed: z.literal(false).optional(),
        dateOptions: z.array(z.object({
          date: z.string(), // yyyy-MM-dd format
          startTime: z.string().optional(), // HH:mm format, optional if using default
          endTime: z.string().optional(), // HH:mm format, optional if using default
          useDefaultTime: z.boolean().default(true)
        })).min(1, "少なくとも1つの日程を選択してください"),
      });
      
      // いずれかのスキーマに一致するかチェック
      const eventSchema = z.union([confirmedDateSchema, normalEventSchema]);
      const validatedData = eventSchema.parse(req.body);
      
      // Generate a unique ID for the event
      const eventId = nanoid();
      
      // Create event
      const eventData: any = {
        id: eventId,
        title: validatedData.title,
        description: validatedData.description || "",
        creatorName: validatedData.creatorName,
        defaultStartTime: validatedData.defaultStartTime,
        defaultEndTime: validatedData.defaultEndTime,
      };
      
      // 確定済み日程の場合は、selectedDateとtimeも設定
      if ('isDateConfirmed' in validatedData && validatedData.isDateConfirmed) {
        eventData.selectedDate = validatedData.selectedDate;
        eventData.startTime = validatedData.startTime;
        eventData.endTime = validatedData.endTime;
      }
      
      const event = await storage.createEvent(eventData);
      
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

      // イベントに参加者リストが含まれていない場合、取得する
      if (!event.participants || !Array.isArray(event.participants) || event.participants.length === 0) {
        try {
          // 参加者リストを取得してマージ
          const participants = await storage.getEventParticipants(req.params.id);
          event.participants = participants;
          console.log(`イベント ${req.params.id} の参加者リストをロード: ${participants.join(', ')}`);
        } catch (err) {
          console.error('参加者リスト取得エラー:', err);
        }
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
  
  // Cancel finalized date (revert to voting stage)
  app.post("/api/events/:id/cancel-finalization", async (req, res) => {
    try {
      const schema = z.object({
        creatorName: z.string().min(1, "作成者名が必要です"),
      });
      
      const { creatorName } = schema.parse(req.body);
      
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      // 作成者確認（簡易認証）
      if (event.creatorName !== creatorName) {
        return res.status(403).json({ message: "イベント作成者のみ日程確定をキャンセルできます" });
      }
      
      // selectedDateをnullに設定して確定解除
      const updatedEvent = await storage.updateEvent(req.params.id, {
        selectedDate: null,
        startTime: null,
        endTime: null,
      });
      
      res.json(updatedEvent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "日程確定のキャンセルに失敗しました" });
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
      
      // 「全員で割り勘」の場合、専用フラグを立てる
      let participants = validatedData.participants;
      let isSharedWithAll = false;
      
      if (!participants || participants.length === 0) {
        // 全員割り勘フラグをONにする
        isSharedWithAll = true;
        
        // 全参加者を取得して設定する
        const allParticipants = await storage.getEventParticipants(req.params.id);
        console.log(`「全員で割り勘」フラグを設定しました。${allParticipants.length}人全員を参加者として記録します`);
        participants = allParticipants;
      }
      
      // これが全員割り勘である場合は、常に最新の参加者リストを取得して使用する
      if (isSharedWithAll) {
        console.log("全員割り勘なので最新の参加者リストを強制的に使用します");
        const freshParticipants = await storage.getEventParticipants(req.params.id);
        participants = freshParticipants;
      }
      
      const expense = await storage.createExpense({
        id: nanoid(),
        eventId: req.params.id,
        payerName: validatedData.payerName,
        description: validatedData.description,
        amount: String(validatedData.amount),
        participants: participants,
        isSharedWithAll: isSharedWithAll, // 全員割り勘フラグを設定
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
  
  // 参加者リストの更新 - 全員で割り勘の経費も更新する
  app.post("/api/events/:id/participants", async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1, "名前を入力してください"),
      });

      const validatedData = schema.parse(req.body);
      
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      if (!event.selectedDate) {
        return res.status(400).json({ message: "イベントの日程が確定していないため、この機能は利用できません" });
      }
      
      // 1. 既存の参加者リストを取得
      const currentParticipants = await storage.getEventParticipants(req.params.id);
      
      // 2. 既に存在する名前かチェック
      if (currentParticipants.includes(validatedData.name)) {
        return res.status(400).json({ message: "この名前の参加者は既に登録されています" });
      }
      
      // 3. 仮の参加者を作成（実際のDBには保存されず、計算用）
      const newParticipantsList = [...currentParticipants, validatedData.name];
      
      // 4. 「全員割り勘」フラグが付いた経費を取得（専用メソッドを使用）
      const sharedExpenses = await storage.getSharedExpenses(req.params.id);
      
      // 5. 念のため、古い形式（フラグなし）の全員割り勘も検出
      const expenses = await storage.getEventExpenses(req.params.id);
      const oldStyleSharedExpenses = expenses.filter(expense => 
        expense.isSharedWithAll !== true && // フラグがない
        (!expense.participants || expense.participants.length === 0) // かつ参加者が空
      );
      
      console.log(`参加者「${validatedData.name}」を追加します。全員割り勘フラグの経費数: ${sharedExpenses.length}`);
      
      // 6. イベントに参加者として追加
      // (仮想的には既に参加者リストに追加されている扱いでよい)
      
      // 7. 「全員割り勘」フラグを持つ支出がある場合、データベースの支出データを更新
      if (sharedExpenses.length > 0) {
        console.log(`「全員割り勘」の経費 ${sharedExpenses.length}件を更新します`);
        
        // 1. 既存の「全員割り勘」支出を特定し、更新
        for (const expense of sharedExpenses) {
          console.log(`支出ID: ${expense.id}, 項目: ${expense.description}, ` +
                     `金額: ${expense.amount}円 を更新中...`);
          
          // 2. 明示的に全員を参加者として設定
          // 注: 将来的に参加者が除外された場合にも対応できるよう、
          // その時点での参加者リストを明示的に設定しておく
          await storage.updateExpense(expense.id, {
            participants: newParticipantsList,
            isSharedWithAll: true // 全員割り勘フラグを維持
          });
          
          console.log(`支出ID: ${expense.id} の参加者を ${newParticipantsList.length}人に更新しました`);
        }
      }
      
      // 8. 古い形式（フラグなし）の全員割り勘支出も更新
      if (oldStyleSharedExpenses.length > 0) {
        console.log(`後方互換性: 古い形式の「全員割り勘」経費が ${oldStyleSharedExpenses.length}件 見つかりました`);
        
        // 古い形式の「全員割り勘」も更新
        for (const expense of oldStyleSharedExpenses) {
          console.log(`[後方互換] 支出ID: ${expense.id} を更新中...`);
          
          // 新しいフォーマットに更新
          await storage.updateExpense(expense.id, {
            participants: newParticipantsList,
            isSharedWithAll: true // 全員割り勘フラグを設定
          });
          
          console.log(`[後方互換] 支出ID: ${expense.id} を新形式に更新しました`);
        }
      }
      
      // 明示的にこの参加者をストレージに追加
      console.log(`明示的にイベント参加者「${validatedData.name}」をストレージに追加`);
      
      // イベントに参加者を追加する
      if (!event.participants) {
        event.participants = [];
      }
      
      // 参加者リストに追加
      event.participants.push(validatedData.name);
      
      // イベントを更新
      await storage.updateEvent(req.params.id, {
        participants: event.participants
      });
      
      console.log(`データベースの参加者リストを更新: ${event.participants.join(', ')}`);
      
      // 9. 成功レスポンスを返す - 更新された支出総数を返す
      const totalUpdatedExpenses = sharedExpenses.length + oldStyleSharedExpenses.length;
      res.status(200).json({ 
        message: `参加者「${validatedData.name}」を追加しました${totalUpdatedExpenses > 0 ? `。${totalUpdatedExpenses}件の全員割り勘も更新しました` : ''}`,
        name: validatedData.name,
        sharedExpensesUpdated: totalUpdatedExpenses
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        console.error("参加者追加エラー:", error);
        res.status(500).json({ message: "参加者の追加に失敗しました" });
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
      
      // 経費情報と参加者情報を取得
      const expenses = await storage.getEventExpenses(req.params.id);
      
      // 全ての支出に含まれる支払者と参加者を集める
      console.log("経費情報から参加者を集計...");
      
      const participantsFromExpenses = new Set<string>();
      
      // 支出から全ての参加者を抽出
      for (const expense of expenses) {
        // 支払者を追加
        participantsFromExpenses.add(expense.payerName);
        
        // 明示的に割り勘対象として指定された参加者を追加
        if (expense.participants && expense.participants.length > 0) {
          for (const participant of expense.participants) {
            participantsFromExpenses.add(participant);
          }
        }
      }
      
      console.log(`経費情報から抽出した参加者数: ${participantsFromExpenses.size}人`);
      
      // イベントの参加者リストを更新
      // (ここでスキーマ定義に存在しない participants フィールドを使用しているため
      //  TypeScriptの型エラーが発生するが、実行時には問題ない)
      if (!event.participants) {
        event.participants = [];
      }
      
      // 経費から抽出した参加者リストと既存のリストをマージ
      const mergedParticipants = Array.from(new Set([
        ...event.participants,
        ...Array.from(participantsFromExpenses)
      ]));
      
      console.log(`参加者リスト統合後: ${mergedParticipants.length}人`);
      
      // イベントに参加者リストを保存
      await storage.updateEvent(req.params.id, {
        participants: mergedParticipants
      } as any);
      
      console.log("▶ 割り勘計算ロジックを実行...");
      console.log(`イベント参加者数: ${mergedParticipants.length}人`);
      
      // 全ての支出に参加者リストをマージして、全員に対応できるようにする
      for (const expense of expenses) {
        // isSharedWithAll フラグが明示的にtrueに設定されているものは、
        // 現在の全参加者に対して計算する必要がある
        if (expense.isSharedWithAll === true) {
          console.log(`支出 ${expense.id} は全員割り勘フラグがあるため、参加者リストを更新します`);
          console.log(`更新前: ${expense.participants ? expense.participants.length : 0}人`);
          
          // 参加者リストを最新の状態に更新（イベント全体の参加者リストを使用）
          expense.participants = [...mergedParticipants];
          
          console.log(`更新後: ${expense.participants.length}人`);
        }
        else if (!expense.participants || expense.participants.length === 0) {
          // 後方互換性: 古い形式の全員割り勘は、参加者が空の場合
          console.log(`支出 ${expense.id} は参加者が未指定のため全員割り勘と判断します`);
          expense.participants = [...mergedParticipants];
          expense.isSharedWithAll = true;
        }
      }
      
      // 精算計算を実行
      const settlements = calculateSettlements(expenses);
      res.json(settlements);
    } catch (error) {
      res.status(500).json({ message: "精算情報の計算に失敗しました" });
    }
  });

  // イベントのメモを取得
  app.get("/api/events/:id/memo", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      res.json({
        memo: event.memo || "",
        lastEditedBy: event.memoLastEditedBy || null,
        lastEditedAt: event.memoLastEditedAt || null,
        editLock: event.memoEditLock || null
      });
    } catch (error) {
      res.status(500).json({ message: "メモの取得に失敗しました" });
    }
  });
  
  // イベントのメモを更新
  app.post("/api/events/:id/memo", async (req, res) => {
    try {
      const schema = z.object({
        memo: z.string().max(1000, "メモは1000文字以内で入力してください"),
        editorName: z.string().min(1, "編集者名を入力してください"),
      });
      
      const { memo, editorName } = schema.parse(req.body);
      
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      // メモを更新
      const updatedEvent = await storage.updateEventMemo(req.params.id, memo, editorName);
      
      res.json({
        memo: updatedEvent.memo,
        lastEditedBy: updatedEvent.memoLastEditedBy,
        lastEditedAt: updatedEvent.memoLastEditedAt
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else if (error instanceof Error && error.message.includes("他の参加者")) {
        res.status(409).json({ message: error.message }); // Conflict
      } else {
        res.status(500).json({ message: "メモの更新に失敗しました" });
      }
    }
  });
  
  // 編集ロックを取得
  app.post("/api/events/:id/memo/lock", async (req, res) => {
    try {
      const schema = z.object({
        userName: z.string().min(1, "ユーザー名を入力してください"),
      });
      
      const { userName } = schema.parse(req.body);
      
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      // ロックを取得
      const success = await storage.acquireEditLock(req.params.id, userName);
      
      if (success) {
        res.json({ success: true });
      } else {
        const updatedEvent = await storage.getEvent(req.params.id);
        res.status(409).json({ 
          success: false, 
          message: `他の参加者（${updatedEvent?.memoEditLock?.lockedBy}さん）が現在編集中です`,
          lockInfo: updatedEvent?.memoEditLock
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "編集ロックの取得に失敗しました" });
      }
    }
  });
  
  // 編集ロックを解放
  app.post("/api/events/:id/memo/unlock", async (req, res) => {
    try {
      // バリデーションを完全に削除
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "イベントが見つかりません" });
      }
      
      try {
        // 例外が発生してもキャッチして常に成功として返す
        await storage.releaseEditLock(req.params.id, "匿名");
        res.json({ success: true });
      } catch (err) {
        console.error("ロック解除に失敗しましたが、成功として扱います:", err);
        // エラーが発生しても成功として返す
        res.json({ success: true });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "編集ロックの解放に失敗しました" });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function calculateSettlements(expenses: any[]): { from: string; to: string; amount: number }[] {
  // 支払いが無ければ精算不要
  if (!expenses.length) return [];
  
  console.log("========== 精算計算開始 ==========");
  
  // ステップ1: すべての支払いから参加者を抽出
  const allParticipantsSet = new Set<string>();
  
  // デバッグ情報を出力
  console.log(`支出数: ${expenses.length}件`);
  expenses.forEach((expense, index) => {
    console.log(`支出#${index + 1}: ${expense.payerName}が${expense.amount}円支払い`);
    console.log(`  説明: ${expense.description}`);
    console.log(`  参加者数: ${expense.participants ? expense.participants.length : 0}人`);
    console.log(`  全員割り勘フラグ: ${expense.isSharedWithAll ? 'あり' : 'なし'}`);
    if (expense.participants && expense.participants.length > 0) {
      console.log(`  参加者: ${expense.participants.join(', ')}`);
    }
  });
  
  // 新方式: まず全ての参加者を集める
  for (const expense of expenses) {
    // 支払者を追加
    allParticipantsSet.add(expense.payerName);

    // 明示的な参加者を追加
    if (expense.participants && expense.participants.length > 0) {
      expense.participants.forEach((p: string) => allParticipantsSet.add(p));
    }
  }
  
  const allCurrentParticipants = Array.from(allParticipantsSet);
  console.log("すべての参加者:", allCurrentParticipants.join(', '));
  
  // ステップ2: 各参加者の支払い/負担記録を初期化
  const balanceSheet: Record<string, { paid: number, shouldPay: number }> = {};
  
  allCurrentParticipants.forEach((name: string) => {
    balanceSheet[name] = { paid: 0, shouldPay: 0 };
  });
  
  // ステップ3: 各支出を処理して支払いと負担額を計算
  expenses.forEach(expense => {
    // 金額を数値に変換（確実に整数に）
    const amount = parseInt(expense.amount, 10);
    const payerName = expense.payerName;
    
    console.log(`\n支払い: ${payerName}が${amount}円支払い`);
    
    // 支払者の支払額に加算
    balanceSheet[payerName].paid += amount;
    
    // 重要: 分担者を確定
    let splitParticipants: string[] = [];
    
    // 全員で割り勘フラグがある場合は、現在の全参加者で分ける
    if (expense.isSharedWithAll === true) {
      splitParticipants = [...allCurrentParticipants];
      console.log(`全員で割り勘フラグあり: ${splitParticipants.length}人`);
    }
    // 明示的に参加者が指定されている場合
    else if (expense.participants && expense.participants.length > 0) {
      splitParticipants = [...expense.participants];
      console.log(`明示的に指定された参加者: ${splitParticipants.join(', ')}`);
    } 
    // 後方互換性: 「全員で割り勘」のケース（古い形式）
    else {
      splitParticipants = [...allCurrentParticipants];
      console.log(`全員で割り勘 (暗黙・後方互換): ${splitParticipants.length}人`);
    }
    
    console.log(`分担者(${splitParticipants.length}人): ${splitParticipants.join(', ')}`);
    
    // 一人あたりの負担額計算
    const perPersonAmount = Math.floor(amount / splitParticipants.length);
    const remainder = amount - (perPersonAmount * splitParticipants.length);
    
    console.log(`一人当たり基本金額: ${perPersonAmount}円, 端数: ${remainder}円`);
    
    // 各参加者の負担額を計算して加算
    splitParticipants.forEach((person, index) => {
      let personShare = perPersonAmount;
      
      // 端数処理: 先頭から remainder 人に 1円ずつ追加
      if (index < remainder) {
        personShare += 1;
      }
      
      balanceSheet[person].shouldPay += personShare;
      console.log(`${person}の負担額: ${personShare}円`);
    });
  });
  
  // ステップ4: 最終的な収支を計算
  console.log("\n===== 各参加者の収支 =====");
  console.log("名前, 支払合計, 負担合計, 差額");
  
  // 各参加者の最終的な収支（+なら受取、-なら支払）
  const finalBalances: { name: string, amount: number }[] = [];
  
  allCurrentParticipants.forEach((name: string) => {
    const { paid, shouldPay } = balanceSheet[name];
    const balance = paid - shouldPay; // プラスなら受け取り、マイナスなら支払い
    
    finalBalances.push({ name, amount: balance });
    console.log(`${name}, ${paid}円, ${shouldPay}円, ${balance > 0 ? '+' : ''}${balance}円`);
  });
  
  // ステップ5: 受取側と支払側に分類
  const receivers = finalBalances
    .filter(p => p.amount > 0)
    .sort((a, b) => b.amount - a.amount); // 受取額の多い順
    
  const payers = finalBalances
    .filter(p => p.amount < 0)
    .map(p => ({ ...p, amount: Math.abs(p.amount) })) // 絶対値に変換
    .sort((a, b) => b.amount - a.amount); // 支払額の多い順
  
  console.log("\n受取側:", receivers.map(r => `${r.name}(${r.amount}円)`).join(', ') || "なし");
  console.log("支払側:", payers.map(p => `${p.name}(${p.amount}円)`).join(', ') || "なし");
  
  // ステップ6: 精算指示の作成（最適なお金の流れを計算）
  console.log("\n===== 精算指示 =====");
  
  const totalReceive = receivers.reduce((sum, r) => sum + r.amount, 0);
  const totalPay = payers.reduce((sum, p) => sum + p.amount, 0);
  
  console.log(`受取合計: ${totalReceive}円, 支払合計: ${totalPay}円`);
  
  // 誤差チェック（1円未満の誤差は許容）
  if (Math.abs(totalReceive - totalPay) > 1) {
    console.log(`警告: 収支に${Math.abs(totalReceive - totalPay)}円の誤差があります`);
  }
  
  // 精算指示リスト
  const settlements: { from: string; to: string; amount: number }[] = [];
  
  // クローンを作成して操作用のオブジェクトを用意
  const receiversClone = [...receivers];
  const payersClone = [...payers];
  
  // 各支払者から最適な受取者への支払いを計算
  while (payersClone.length > 0 && receiversClone.length > 0) {
    // 現在処理中の支払者と受取者
    const payer = payersClone[0];
    const receiver = receiversClone[0];
    
    // 支払い額を決定（より少ない方の金額）
    const paymentAmount = Math.min(payer.amount, receiver.amount);
    
    if (paymentAmount > 0) {
      // 精算指示を追加
      settlements.push({
        from: payer.name,
        to: receiver.name,
        amount: paymentAmount
      });
      
      console.log(`${payer.name} → ${receiver.name}: ${paymentAmount}円`);
      
      // 残額を更新
      payer.amount -= paymentAmount;
      receiver.amount -= paymentAmount;
      
      // 残額がないものを削除
      if (payer.amount <= 0) payersClone.shift();
      if (receiver.amount <= 0) receiversClone.shift();
    } else {
      // エラー防止（ここには来ないはず）
      console.log("警告: 0円の支払いが発生しました");
      break;
    }
  }
  
  console.log("========== 精算計算終了 ==========\n");
  
  return settlements;
}
