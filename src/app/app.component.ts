import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ISong } from './interfaces/isong';
import { CommonModule } from '@angular/common';

import { AppSettingsDb, db, SongDb } from './dexie/db';
import { liveQuery } from 'dexie';
import { PlayerStateEnum } from './constants/playerStateEnum';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'winamp-web';
  songs$ = liveQuery(() => db.songs.toArray());
  appSettings$ = liveQuery(() => db.appSettings.toArray());

  playerState: PlayerStateEnum = PlayerStateEnum.stopped;
  newSong = true;

  appSettings!: AppSettingsDb;

  audioCtx = new window.AudioContext();
  sourceSong: AudioBufferSourceNode | undefined;

  audioFiles: File[] = [];

  currentSong?: SongDb;
  sliderValue = 0;
  sliderMaxValue = 0;

  constructor() {
    this.appSettings$.subscribe(async value => {
      this.appSettings = value[0];

      this.currentSong = await db.songs.filter(s => s.selected == true).first();
    });

    this.audioCtx.onstatechange = () => {
      console.log('audioCtx.state', this.audioCtx.state);
    };

    setInterval(() => {
      this.sliderValue = this.audioCtx.currentTime
      this.sliderMaxValue = (this.currentSong?.length ?? 0) / 24098;
    }, 1000);
  }

  songs: ISong[] = [];

  async selectSong(song: SongDb) {
    if (song.name !== this.selectSong.name) {
      this.newSong = true;
      this.audioCtx = new window.AudioContext();
      await this.audioCtx.suspend();
      this.sourceSong?.stop();
    } else {
      this.newSong = false;
    }

    this.songs.forEach(item => {
      item.selected = false;
    });

    song.selected = true;

    let selectedSong = await db.songs.filter(s => s.selected === true).first();
    await db.songs.update(selectedSong?.id ?? 0, { selected: false });

    await db.songs.update(song?.id!, { selected: true });

    this.currentSong = song;
  }

  async play() {
    console.log('currentTime', this.audioCtx.currentTime);

    if (this.audioCtx.state === 'running') {
      await this.audioCtx.suspend();
      this.playerState = PlayerStateEnum.paused;
      return;
    } else if (this.audioCtx.state === 'suspended' && this.playerState === PlayerStateEnum.paused && !this.newSong) {
      await this.audioCtx.resume();
      this.playerState = PlayerStateEnum.playing;
      return;
    }

    console.log('settings', this.appSettings);

    if (!this.appSettings.fileSystemDirectoryHandle) {
      return;
    }

    let fileToPlay: File | undefined;

    for await (const entry of this.appSettings.fileSystemDirectoryHandle.values()) {
      if (entry.kind !== 'file') {
        continue;
      }

      const file = await entry.getFile();
      if (file.name === this.currentSong?.name) {
        fileToPlay = file;
        break;
      }
    }

    if (fileToPlay) {
      // if (this.sourceSong) {
      //   this.sourceSong.disconnect(this.audioCtx.destination);
      // }

      this.sourceSong = this.audioCtx.createBufferSource();
      const audioBuffer = await fileToPlay.arrayBuffer()
        .then(ArrayBuffer => this.audioCtx.decodeAudioData(ArrayBuffer));

      this.sourceSong.buffer = audioBuffer;
      this.sourceSong.connect(this.audioCtx.destination);
      this.sourceSong.start();
      await this.audioCtx.resume();
      this.newSong = false;
    } else {

    }
  }

  audioContextChange(change: any) {
    console.log('audio context change', change);
  }

  async openFolder(event: any) {
    const dirHandle = await window.showDirectoryPicker();

    await db.appSettings.update(1, { fileSystemDirectoryHandle: dirHandle });

    const promises = [];
    this.songs = [];
    await db.songs.clear();

    let maxNumberOfSongs = 10;

    for await (const entry of dirHandle.values()) {
      if (entry.kind !== 'file') {
        continue;
      }

      maxNumberOfSongs--;
      // if (maxNumberOfSongs == 0) {
      //   break;
      // }

      promises.push(entry.getFile().then(async (file: File) => {

        if (['audio/mpeg'].includes(file.type)) {

          // let audioBuffer = await file.arrayBuffer();
          // let data = await this.audioCtx.decodeAudioData(audioBuffer);
          const durationInSeconds = 3 * 60 + 35;


          const song: ISong = {
            name: file.name + file.size,
            length: `${(Math.floor(durationInSeconds / 60))}:${(Math.floor(durationInSeconds % 60))}`
          };
          this.audioFiles.push(file);
          this.songs.push(song);

          await db.songs.add({
            name: file.name,
            length: file.size,
            duration: song.length,
            selected: false
          });
        }
      }));
    }

    const files = await Promise.all(promises);
    console.log(files);

    // files.map(f => this.songs.push({ name: f, }))
  }
}
