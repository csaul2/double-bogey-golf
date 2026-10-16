import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { supabase, isSupabaseConfigured } from './supabase';

const QUEUE_STORAGE_KEY = '@tournament_pending_sync_queue_v1';
const LOCAL_SCORES_CACHE_KEY = '@tournament_scores_cache_v1';

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'syncing';

export interface PendingScoreUpdate {
  id: string; // unique mutation id
  roundId: string;
  playerId: string;
  holeNumber: number;
  strokes: number;
  timestamp: number;
}

class SyncManager {
  private queue: PendingScoreUpdate[] = [];
  private isSyncing: boolean = false;
  private isOnline: boolean = true;
  private statusListeners: ((status: SyncStatus, pendingCount: number) => void)[] = [];
  private scoreUpdateListeners: ((score: { roundId: string; playerId: string; holeNumber: number; strokes: number }) => void)[] = [];
  private realtimeChannel: any = null;

  constructor() {
    this.init();
  }

  private async init() {
    // Load pending queue from local persistent storage
    try {
      const savedQueue = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (savedQueue) {
        this.queue = JSON.parse(savedQueue);
      }
    } catch (e) {
      console.warn('Failed to load pending score queue from storage', e);
    }

    // Monitor network connectivity
    NetInfo.addEventListener((state: NetInfoState) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      const wasOffline = !this.isOnline;
      this.isOnline = online;

      if (online && wasOffline && this.queue.length > 0) {
        this.flushQueue();
      }
      this.notifyStatus();
    });

    // Check initial state
    const currentNet = await NetInfo.fetch();
    this.isOnline = Boolean(currentNet.isConnected && currentNet.isInternetReachable !== false);

    // Setup Supabase Realtime if configured
    this.setupRealtimeSubscription();

    // Trigger initial sync attempt if queue has items
    if (this.isOnline && this.queue.length > 0) {
      this.flushQueue();
    } else {
      this.notifyStatus();
    }
  }

  public onStatusChange(listener: (status: SyncStatus, pendingCount: number) => void) {
    this.statusListeners.push(listener);
    listener(this.getStatus(), this.queue.length);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  public onRemoteScoreReceived(listener: (score: { roundId: string; playerId: string; holeNumber: number; strokes: number }) => void) {
    this.scoreUpdateListeners.push(listener);
    return () => {
      this.scoreUpdateListeners = this.scoreUpdateListeners.filter((l) => l !== listener);
    };
  }

  public getStatus(): SyncStatus {
    if (this.isSyncing) return 'syncing';
    if (!this.isOnline) return 'offline';
    if (this.queue.length > 0) return 'pending';
    return 'synced';
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  private notifyStatus() {
    const status = this.getStatus();
    const count = this.queue.length;
    this.statusListeners.forEach((l) => l(status, count));
  }

  /**
   * Called immediately whenever a score is locked in.
   * 1. Saves to local pending queue.
   * 2. Immediately attempts to sync if online.
   */
  public async queueScore(roundId: string, playerId: string, holeNumber: number, strokes: number) {
    const mutation: PendingScoreUpdate = {
      id: `${roundId}_${playerId}_${holeNumber}_${Date.now()}`,
      roundId,
      playerId,
      holeNumber,
      strokes,
      timestamp: Date.now(),
    };

    // Replace any existing pending update for the exact same hole
    this.queue = this.queue.filter(
      (item) => !(item.roundId === roundId && item.playerId === playerId && item.holeNumber === holeNumber)
    );
    this.queue.push(mutation);

    await this.persistQueue();
    this.notifyStatus();

    if (this.isOnline && isSupabaseConfigured()) {
      this.flushQueue();
    }
  }

  private async persistQueue() {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.warn('Failed to persist sync queue', e);
    }
  }

  /**
   * Flushes local outbox queue to Supabase via atomic upsert.
   */
  public async flushQueue() {
    if (this.isSyncing || this.queue.length === 0 || !isSupabaseConfigured() || !this.isOnline) {
      return;
    }

    this.isSyncing = true;
    this.notifyStatus();

    const itemsToSync = [...this.queue];
    const payload = itemsToSync.map((item) => ({
      round_id: item.roundId,
      player_id: item.playerId,
      hole_number: item.holeNumber,
      strokes: item.strokes,
      updated_at: new Date(item.timestamp).toISOString(),
    }));

    try {
      const { error } = await supabase
        .from('scores')
        .upsert(payload, { onConflict: 'round_id,player_id,hole_number' });

      if (error) {
        console.warn('Supabase sync error:', error.message);
      } else {
        // Remove synced items from queue
        const syncedIds = new Set(itemsToSync.map((i) => i.id));
        this.queue = this.queue.filter((i) => !syncedIds.has(i.id));
        await this.persistQueue();
      }
    } catch (err) {
      console.warn('Network sync exception:', err);
    } finally {
      this.isSyncing = false;
      this.notifyStatus();
    }
  }

  /**
   * Subscribes to Supabase Realtime WebSocket channel for scores.
   * Whenever another cart submits a score, this callback updates our local tournament state.
   */
  private setupRealtimeSubscription() {
    if (!isSupabaseConfigured()) return;

    try {
      if (this.realtimeChannel) {
        supabase.removeChannel(this.realtimeChannel);
      }

      this.realtimeChannel = supabase
        .channel('public:scores')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'scores' },
          (payload: any) => {
            const row = payload.new;
            if (row && row.round_id && row.player_id && row.hole_number && row.strokes) {
              this.scoreUpdateListeners.forEach((listener) =>
                listener({
                  roundId: row.round_id,
                  playerId: row.player_id,
                  holeNumber: row.hole_number,
                  strokes: row.strokes,
                })
              );
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription error:', e);
    }
  }
}

export const syncManager = new SyncManager();
