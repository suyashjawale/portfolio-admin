import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, ElementRef, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { State } from '../../services/state';
import { Song } from '../../interfaces/song';

@Component({
	selector: 'app-music',
	imports: [FormsModule],
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

	@ViewChild("musicTag") musicTag!: ElementRef;
	@ViewChild("imageTag") imageTag!: ElementRef;

	constructor(private http: HttpClient, private stateService: State) { }

	ngOnInit() {
		this.updateSongList();
	}

	updateSongList() {
		this.http.get<Song[]>('https://dashing-llama-639318.netlify.app/.netlify/functions/fetchSongs').subscribe({
			next: (data) => {
				this.songList.set(data.sort((a, b) => b.queueNumber - a.queueNumber));
			},
			error: err => {
				alert("Error fetching songs")
			}
		});
	}

	musicTagChange(event: any) {
		this.musicFile = event.target.files[0];
	}

	imageTagChange(event: any) {
		this.imageFile = event.target.files[0];
	}

	async uploadMusic() {
		this.error = [];

		if (!this.musicFile)
			this.error.push("Music File missing")

		if (!this.imageFile)
			this.error.push("Thumbnail missing")

		if (this.songName.trim() == '')
			this.error.push("Song Name missing")

		if (this.artistName.trim() == '')
			this.error.push("Artist Name missing")

		if (this.yt_link.trim() == '')
			this.error.push("Youtube Link missing")

		if (this.customName.trim() == '')
			this.error.push("Custom Name missing")


		if (this.error.length == 0 && this.stateService.loggedIn()) {
			if (confirm("Are you sure you want to submit ?")) {
				this.ongoing.set(true);
				try {
					const musicUrl = await this.uploadFiles(".mp3", this.musicFile);
					const filename = await this.imageFile.name.split(".")
					const thumnailUrl = await this.uploadFiles("." + filename[1], this.imageFile);

					this.http.post<boolean>('https://dashing-llama-639318.netlify.app/.netlify/functions/addSong', {
						songName: this.songName,
						"artistName": this.artistName,
						"songLink": musicUrl,
						"thumbnailLink": thumnailUrl,
						"youtube_link": this.yt_link,
						"customName": this.customName,
						"password": this.stateService.password(),
						"rank": this.priority, 
						"queueNumber" : this.songList().length,
					}).subscribe({
						next: (data) => {
							this.musicTag.nativeElement.value = null;
							this.imageTag.nativeElement.value = null;
							this.imageFile = null;
							this.songName = "";
							this.artistName = "";
							this.yt_link = "";
							this.customName = "";
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

	uploadFiles(fileExtension: string, ogFile: File): Promise<string> {

		return new Promise((resolve, reject) => {

			const dropboxPath = "/" + this.customName + fileExtension;

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

				},
				error: err1 => {
					reject("Upload failed: " + err1);
				}
			});

		});
	}

}
