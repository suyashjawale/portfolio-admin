import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { State } from '../../services/state';
import { zip } from 'rxjs';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environment/environment';

@Component({
	selector: 'app-wisdom',
	imports: [FormsModule, DatePipe],
	templateUrl: './wisdom.html',
	styleUrl: './wisdom.scss',
})
export class Wisdom {
	error: string[] = [];
	link = signal<string>('');
	previewUrl = signal<string>('');
	title = signal<string>('');
	description = signal<string>('');
	telegrambotlink = signal<string>('');
	freediumLink = signal<string>('');
	imageHeight = signal<number>(0);
	imageWidth = signal<number>(0);
	identifier = signal<string>('');
	wisdoms = signal<any>([]);
	editMode = signal<boolean>(false);
	ongoing = signal<boolean>(false);
	imageExt = signal<string>('');
	zipFile: any = null;
	publishedDate = signal<string>('');

	constructor(private http: HttpClient, public stateService: State) { }

	onImageLoad(height: number, width: number) {
		this.imageHeight.set(height);
		this.imageWidth.set(width);
	}

	fileTagChange(event: any) {
		this.zipFile = event.target.files[0];
	}

	fetchDetails() {

		const headers = new HttpHeaders({
			'Content-Type': 'application/json',
			'X-Site-Identity': 'portfolio-admin-v1'
		});

		this.http.post(environment.domain+ '.netlify/functions/getBlogDetails', { "password": this.stateService.password(), "link": this.link() }, { responseType: 'text', headers }).subscribe({
			next: async (data: string) => {
				const parser = new DOMParser();
				const doc = parser.parseFromString(data, 'text/html');

				const titleTag = doc.querySelector('title');
				this.title.set(titleTag ? titleTag.textContent : '')

				const descriptionTag = doc.querySelector("meta[name='description']") || doc.querySelector("meta[property='og:description']");
				const content = descriptionTag ? descriptionTag.getAttribute('content') : '';
				this.description.set(content || '');

				const imageTag = doc.querySelector("meta[property='og:image']") || doc.querySelector("meta[name='image']");
				const preview = imageTag ? imageTag.getAttribute('content') : '';
				this.previewUrl.set(preview || '');

				const response = await fetch(this.previewUrl(), { method: 'HEAD' });
				const contentType = response.headers.get('Content-Type')?.split("/")[1];
				this.imageExt.set("." + contentType || '');

				const publishDate = doc.querySelector("meta[property='article:published_time']");
				const pubDate = publishDate ? publishDate.getAttribute('content') : '';
				this.publishedDate.set(pubDate || '');

				if (this.link().includes("medium.com")) {
					this.freediumLink.set('https://freedium-mirror.cfd/' + this.link())
				}

				this.telegrambotlink.set(`https://t.me/webtozip_bot?text=${this.freediumLink() == '' ? this.link() : this.freediumLink()}`)
			},
			error: err => {
				console.log(err);
			}
		});
	}

	ngOnInit() {
		this.fetchLinks();
	}

	fetchLinks() {

		const headers = new HttpHeaders({
			'Content-Type': 'application/json',
			'X-Site-Identity': 'portfolio-admin-v1'
		});

		this.http.get(environment.domain+ '.netlify/functions/getWisdom', { headers }).subscribe({
			next: (data : any) => {
				this.wisdoms.set(data.sort((a:any, b:any) => b.uploadIndex - a.uploadIndex));
			},
			error: err => {
				this.wisdoms.set([]);
			}
		});
	}

	async postWisdom() {
		this.error = [];

		if (this.identifier().trim() == '')
			this.error.push("Identifier is missing")

		if (this.link().trim() == '')
			this.error.push("Link is missing")

		if (!this.zipFile)
			this.error.push("Zip is missing")

		if (this.error.length != 0)
			window.scrollTo(0, 0);

		if (this.error.length == 0 && this.stateService.loggedIn()) {
			if (confirm("Are you sure you want to submit ?")) {
				this.ongoing.set(true);

				this.http.get(this.previewUrl(), { responseType: 'blob' }).subscribe(async (blob: Blob) => {
					const imageUrl = await this.uploadFiles(blob, this.imageExt());
					const fileURL = await this.uploadFiles(this.zipFile, "." + this.zipFile.name.split(".")[1]);

					const payload = {
						'ogLink': this.link(),
						'freediumLink': this.freediumLink(),
						'zipLink': fileURL,
						'zipExtn': "." + this.zipFile.name.split(".")[1],
						'imageExtn': this.imageExt(),
						'imageurl': imageUrl,
						'title': this.title(),
						'description': this.description(),
						'publishedDate': this.publishedDate(),
						'height': this.imageHeight(),
						'width': this.imageWidth(),
						'identifier': this.identifier().trim().replaceAll(" ", "_").toLowerCase(),
						'password': this.stateService.password(),
						'uploadIndex' : this.wisdoms().length
					}

					const headers = new HttpHeaders({
						'Content-Type': 'application/json',
						'X-Site-Identity': 'portfolio-admin-v1'
					});


					this.http.post(environment.domain + '.netlify/functions/addWisdom', payload, { headers }).subscribe({
						next: (data) => {
							this.wisdoms.set(data);
							this.reset();
						},
						error: err => {
							this.wisdoms.set([]);
						},
						complete: () => {
							this.ongoing.set(false);
							this.fetchLinks();
						}
					});

				});
			}
			else if (!this.stateService.loggedIn() && this.error.length == 0) {
				alert("Kindly Login");
			}
		}
	}

	async deleteWisdom(item: any) {
		if (this.stateService.loggedIn()) {
			if (confirm("Are you sure you want to delete ?")) {
				this.ongoing.set(true);
				await this.deleteFromDropbox(`/Wisdom/${item.identifier}${item.imageExtn}`)
				await this.deleteFromDropbox(`/Wisdom/${item.identifier}${item.zipExtn}`)

				const headers = new HttpHeaders({
					'Content-Type': 'application/json',
					'X-Site-Identity': 'portfolio-admin-v1'
				});

				this.http.post( environment.domain+ ".netlify/functions/deleteWisdom", {
					"customName": item.identifier,
					"password": this.stateService.password()
				}, { headers }).subscribe({
					next: res => {
						this.fetchLinks();
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

	reset() {
		this.link.set('');
		this.previewUrl.set('');
		this.title.set('');
		this.description.set('');
		this.telegrambotlink.set('');
		this.freediumLink.set('');
		this.imageHeight.set(0);
		this.imageWidth.set(0);
		this.identifier.set('');
		this.zipFile = null;
		this.publishedDate.set('');
		this.imageExt.set('');
	}

	openLink(postLink: string) {
		window.open(postLink);
	}

	uploadFiles(ogFile: any, extension: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const dropboxPath = "/Wisdom/" + this.identifier().trim().replaceAll(" ", "_").toLowerCase() + extension;
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
