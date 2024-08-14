import Dexie, { Table } from 'dexie';

export interface SongDb {
    id?: number;
    name: string;
    duration: string;
    length: number;
    selected?: boolean;
}

export interface AppSettingsDb {
    id?: number;
    version: string,
    fileSystemDirectoryHandle?: FileSystemDirectoryHandle
}

export class AppDb extends Dexie {
    songs!: Table<SongDb, number>;
    appSettings!: Table<AppSettingsDb, number>

    constructor() {
        super('ngdexieliveQuery');
        this.version(3).stores({
            songs: '++id',
            appSettings: '++id'
        });
        this.on('populate', () => this.populate());
    }

    async populate() {
        await db.appSettings.add({ version: '0.0.1' });
    }
}

export const db = new AppDb();