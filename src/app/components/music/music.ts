import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, ElementRef, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { State } from '../../services/state';
import { Song } from '../../interfaces/song';
import { finalize } from 'rxjs';
import { SortPipe } from '../../pipes/sort-pipe';
import { DomSanitizer } from '@angular/platform-browser';
import { environment } from '../../../environment/environment';

@Component({
	selector: 'app-music',
	imports: [FormsModule, SortPipe],
	templateUrl: './music.html',
	styleUrl: './music.scss',
})
export class Music {

	musicFile: any = null;
	imageFile: any = null;
	error: string[] = [];
	songList = signal<Song[]>([]);
	songName: string = '';
	artistName: string = '';
	yt_link: string = '';
	customName: string = '';
	ongoing = signal<boolean>(false);
	priority: number = 1;
	sortCriteria: string = 'queueNumber';
	sortSeries: string = 'desc';
	holdEdit = signal<boolean>(false);
	previewUrl = signal<any>(null);
	previewAudio = signal<any>(null);

	previewAudioExt = signal<string>('');
	previewImageExt = signal<string>('');
	editMode = signal<boolean>(false);
	selectedSong = signal<Song>({
		artist: '',
		customName: '',
		fileName: '',
		playingSong: false,
		queueNumber: 0,
		rank: 0,
		songName: '',
		tempRank: 0,
		thumbnail: '',
		yt_link: '',
		imageExt: '',
		musicExt: ''
	});

	@ViewChild("musicTag") musicTag!: ElementRef;
	@ViewChild("imageTag") imageTag!: ElementRef;
	@ViewChild("displayImage") displayImage!: ElementRef;
	constructor(private http: HttpClient, public stateService: State, private sanitizer: DomSanitizer) { }

	ngOnInit() {
		this.updateSongList();
	}

	selectEditable(selected: Song) {
		this.editMode.set(true);
		this.selectedSong.set(selected);
		this.previewAudio.set(selected.fileName);
		this.previewUrl.set(selected.thumbnail);
		this.previewAudioExt.set(selected.musicExt);
		this.previewImageExt.set(selected.imageExt);
		this.artistName = selected.artist;
		this.songName = selected.songName;
		this.yt_link = selected.yt_link;
		this.customName = selected.customName;
		this.priority = selected.rank;
		window.scrollTo(0, 0);
	}

	updateSongList() {

		const headers = new HttpHeaders({
			'Content-Type': 'application/json',
			'X-Site-Identity': 'portfolio-admin-v1'
		});

		this.http.get<Song[]>(environment.domain+'.netlify/functions/fetchSongs', { headers }).subscribe({
			next: (data: Song[]) => {
				data = data.map(item => ({ ...item, tempRank: item.rank }));
				if (this.sortCriteria == 'queueNumber')
					this.songList.set(data.sort((a, b) => b.queueNumber - a.queueNumber));
				else
					this.songList.set(data.sort((a, b) => b.rank - a.rank));
			},
			error: err => {
				alert("Error fetching songs")
			}
		});
	}

	musicTagChange(event: any) {
		this.musicFile = event.target.files[0];
		const url = URL.createObjectURL(this.musicFile);
		this.previewAudio.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
	}

	imageTagChange(event: any) {
		this.imageFile = event.target.files[0];
		const reader = new FileReader();
		reader.onload = () => {
			this.previewUrl.set(reader.result);
		};

		reader.readAsDataURL(this.imageFile);
	}

	updateRank(song: Song) {
		this.holdEdit.set(true);

		const headers = new HttpHeaders({
			'Content-Type': 'application/json',
			'X-Site-Identity': 'portfolio-admin-v1'
		});

		this.http.post(environment.domain+'.netlify/functions/updateRank', {
			"customName": song.customName,
			"password": this.stateService.password(),
			"rank": song.tempRank
		}, { headers }).pipe(finalize(() => {
			this.holdEdit.set(false);
		}))
			.subscribe({
				next: (data) => {
					song.rank = song.tempRank;
				},
				error: (err) => {
					song.tempRank = song.rank;
				}
			});
	}

	async uploadMusic() {
		this.error = [];

		if (!this.musicFile && !this.editMode())
			this.error.push("Music File missing")

		if (!this.imageFile && !this.editMode())
			this.error.push("Thumbnail missing")

		if (this.songName.trim() == '')
			this.error.push("Song Name missing")

		if (this.artistName.trim() == '')
			this.error.push("Artist Name missing")

		if (this.yt_link.trim() == '')
			this.error.push("Youtube Link missing")

		if (this.customName.trim() == '')
			this.error.push("Custom Name missing")

		if (this.editMode() && this.songName.trim() == this.selectedSong().songName
			&& this.artistName.trim() == this.selectedSong().artist
			&& this.yt_link.trim() == this.selectedSong().yt_link
			&& !this.musicFile && !this.imageFile
		) {
			this.error.push("No changes made")
		}

		if (this.error.length != 0)
			window.scrollTo(0, 0);

		if (this.error.length == 0 && this.stateService.loggedIn()) {
			if (confirm("Are you sure you want to submit ?")) {
				this.ongoing.set(true);
				try {
					const musicExt = this.previewAudioExt() == '' ? "." + this.musicFile.name.split(".")[1] : this.previewAudioExt();
					const imageExt = this.previewImageExt() == '' ? "." + this.imageFile.name.split(".")[1] : this.previewImageExt();

					const musicUrl = this.musicFile ? await this.uploadFiles(musicExt, this.musicFile) : this.previewAudio();
					const thumnailUrl = this.imageFile ? await this.uploadFiles(imageExt, this.imageFile) : this.previewUrl();


					const headers = new HttpHeaders({
						'Content-Type': 'application/json',
						'X-Site-Identity': 'portfolio-admin-v1'
					});

					this.http.post<boolean>(environment.domain+'.netlify/functions/addSong', {
						"songName": this.songName.trim(),
						"artistName": this.artistName.trim(),
						"songLink": musicUrl,
						"thumbnailLink": thumnailUrl,
						"youtube_link": this.yt_link.trim(),
						"customName": this.customName.trim().replaceAll(" ", "_").toLowerCase(),
						"password": this.stateService.password().trim(),
						"rank": this.priority,
						"queueNumber": this.songList().length,
						"musicExt": musicExt,
						"imageExt": imageExt
					}, { headers }).subscribe({
						next: (data) => {
							this.reset();
							this.updateSongList();
							alert("Music File Uploaded SuccessFully")
						},
						error: (error) => {
							this.error.push('Error :' + error.error);
						},
						complete: () => {
							this.ongoing.set(false);
						}
					});
				}
				catch (err: any) {
					this.ongoing.set(false);
					this.error.push(err.toString());
				}
			}
		}
		else if (!this.stateService.loggedIn() && this.error.length == 0) {
			alert("Kindly Login");
		}
	}

	reset() {
		this.musicTag.nativeElement.value = null;
		this.imageTag.nativeElement.value = null;
		this.imageFile = null;
		this.musicFile = null;
		this.editMode.set(false);
		this.selectedSong.set({
			artist: '',
			customName: '',
			fileName: '',
			playingSong: false,
			queueNumber: 0,
			rank: 0,
			songName: '',
			tempRank: 0,
			thumbnail: '',
			yt_link: '',
			musicExt: '',
			imageExt: ''
		});
		this.previewAudio.set(null);
		this.previewUrl.set(null);
		this.previewAudioExt.set('');
		this.previewImageExt.set('');
		this.artistName = '';
		this.songName = '';
		this.yt_link = '';
		this.customName = '';
		this.priority = 1;
		this.error = [];
		window.scrollTo(0, 0);
	}


	async deleteFile(song: Song) {
		if (this.stateService.loggedIn()) {
			if (confirm("Are you sure you want to submit ?")) {
				this.ongoing.set(true);
				await this.deleteFromDropbox(`/Music/${song.customName}${song.imageExt}`)
				await this.deleteFromDropbox(`/Music/${song.customName}${song.musicExt}`)

				const headers = new HttpHeaders({
					'Content-Type': 'application/json',
					'X-Site-Identity': 'portfolio-admin-v1'
				});

				this.http.post(environment.domain+".netlify/functions/deleteSong", {
					"customName": song.customName,
					"password": this.stateService.password()
				}, { headers }).subscribe({
					next: res => {
						this.updateSongList();
						this.ongoing.set(false);
						this.reset();
					}
				})
			}
		}
		else {
			alert("Kindly Login");
		}
	}

	deleteFromDropbox(path: string) {

		return new Promise((resolve, reject) => {
			const url = "https://api.dropboxapi.com/2/files/delete_v2";

			const headers = new HttpHeaders({
				"Authorization": `Bearer ${this.stateService.dropbox_access_token()}`,
				"Content-Type": "application/json"
			});

			return this.http.post(url, { path }, { headers }).subscribe({
				next: data => {
					resolve("Deleted SuccessFully");
				},
				error: err => {
					reject("Error in deleting")
				}
			});
		})

	}

	uploadFiles(fileExtension: string, ogFile: File): Promise<string> {

		return new Promise((resolve, reject) => {
			const dropboxPath = "/Music/" + this.customName.trim().replaceAll(" ", "_").toLowerCase() + fileExtension;

			const headersUpload = new HttpHeaders({
				"Authorization": `Bearer ${this.stateService.dropbox_access_token()}`,
				"Dropbox-API-Arg": JSON.stringify({
					path: dropboxPath,
					mode: "overwrite",
					autorename: false
				}),
				"Content-Type": "application/octet-stream"
			});

			this.http.post("https://content.dropboxapi.com/2/files/upload", ogFile, { headers: headersUpload }).subscribe({
				next: res1 => {

					const shareHeaders = new HttpHeaders({
						"Authorization": `Bearer ${this.stateService.dropbox_access_token()}`,
						"Content-Type": "application/json"
					});

					if (!this.editMode()) {
						this.http.post<any>(
							"https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings",
							{ path: dropboxPath },
							{ headers: shareHeaders }
						).subscribe({
							next: res2 => {

								// STEP 3 — CONVERT TO DIRECT LINK
								const directLink = res2.url
									.replace("www.dropbox.com", "dl.dropboxusercontent.com")
									.replace("?dl=0", "");

								resolve(directLink);
							},
							error: err2 => {
								reject("Share link failed: " + err2);
							}
						});
					}
					else if (this.editMode() && fileExtension == '.mp3') {
						resolve(this.selectedSong().fileName);
					}
					else if (this.editMode()) {
						resolve(this.selectedSong().thumbnail);
					}


				},
				error: err1 => {
					reject("Upload failed: " + err1);
				}
			});

		});
	}

}
