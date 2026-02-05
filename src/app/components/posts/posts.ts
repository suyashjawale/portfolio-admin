import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, ElementRef, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { State } from '../../services/state';

interface IPost {
	location: string,
	isCollection: boolean,
	imageUrl: string,
	caption: string,
	identifier: string,
	title: string,
	body: string,
	timestamp: string,
	password: string
}

@Component({
	selector: 'app-posts',
	imports: [FormsModule],
	templateUrl: './posts.html',
	styleUrl: './posts.scss',
})
export class Posts {
	error: string[] = [];
	previewUrl = signal<any>(null);
	imageFile: any = null;
	alternate_text: string = '';
	title: string = '';
	body: string = '';
	desc: string = "";
	location: string = '';
	priority: number = 11;
	identifier: string = "";
	addToCollection = signal<boolean>(false);
	ongoing = signal<boolean>(false);
	editMode = signal<boolean>(false);
	currentImageHeight = signal<number>(0);
	currentImageWidth = signal<number>(0);
	unique_identifer = signal<string[]>([]);
	image_list = signal<number[]>([]);
	selectedPost = signal<IPost>({
		location: '',
		isCollection: false,
		imageUrl: '',
		caption: '',
		identifier: '',
		title: '',
		body: '',
		timestamp: '',
		password: ''
	})

	posts = signal<any>([]);

	@ViewChild("imageTag") imageTag!: ElementRef;

	imageTagChange(event: any) {
		this.imageFile = event.target.files[0];
		const reader = new FileReader();
		reader.onload = () => {
			this.previewUrl.set(reader.result);
		};
		reader.readAsDataURL(this.imageFile);
	}

	constructor(private http: HttpClient, public stateService: State) { }

	ngOnInit() {
		this.http.get<any>('https://dashing-llama-639318.netlify.app/.netlify/functions/getCollection').subscribe({
			next: data => {
				this.unique_identifer.set(data.map((d: any) => d.identifier));
				this.image_list.set(Array.from({ length: data.length + 1 }, (v, i) => i));
			}
		});

		this.getPosts();
	}

	getPosts() {
		let input = prompt("Enter your number");
		this.http.post<any>('https://dashing-llama-639318.netlify.app/.netlify/functions/getPosts', { "number": input }).subscribe({
			next: data => {
				this.posts.set(data['posts'].map((element: any) => {
					return { ...element, 'isDisabled': true }
				}));
			},
			error: err => {
				this.posts.set([])
			}
		});
	}

	async uploadPost() {
		this.error = [];
		if (this.body.trim() == '')
			this.error.push("Post body is missing")

		if (this.identifier.trim() == '')
			this.error.push("Identifier is missing")

		if (this.addToCollection()) {

			if (this.desc.trim() == '')
				this.error.push("Image Description is missing")

			if (this.unique_identifer().includes(this.identifier.trim().replaceAll(" ", "_").toLowerCase()) && !this.editMode())
				this.error.push("Duplicate Identifier")
		}

		if (this.error.length != 0)
			window.scrollTo(0, 0);

		if (this.error.length == 0 && this.stateService.loggedIn()) {
			if (confirm("Are you sure you want to submit ?")) {
				this.ongoing.set(true);

				try {
					let imageUrl = '';

					let imageExt = '';
					if (this.imageFile || this.previewUrl()) {
						imageExt = "." + this.imageFile.name.split(".")[1];
						imageUrl = this.imageFile ? await this.uploadFiles(imageExt, this.imageFile) : this.previewUrl();
					}

					this.http.post<boolean>('https://dashing-llama-639318.netlify.app/.netlify/functions/addPost', {
						location: this.location,
						isCollection: this.addToCollection(),
						imageUrl: imageUrl,
						caption: this.alternate_text,
						identifier: this.identifier.trim().replaceAll(" ", "_").toLowerCase(),
						title: this.title,
						postBody: this.body,
						timestamp: new Date(),
						password: this.stateService.password(),
						imageExt: imageExt,
						height: this.currentImageHeight(),
						width: this.currentImageWidth()
					}).subscribe({
						next: (data) => {

							if (this.addToCollection()) {
								this.http.post<boolean>('https://dashing-llama-639318.netlify.app/.netlify/functions/addToCollection', {
									altText: this.alternate_text,
									description: this.desc,
									height: this.currentImageHeight(),
									width: this.currentImageWidth(),
									identifier: this.identifier.trim().replaceAll(" ", "_").toLowerCase(),
									location: this.location,
									priority: this.priority,
									url: imageUrl,
									password: this.stateService.password(),
									uploadDate: new Date(),
									imageExt: imageExt,
									folder: 'Posts'
								}).subscribe({
									next: (data) => {
										alert("Post added successfully")
										this.reset();
										this.getPosts();
									},
									error: (err) => {
										alert("Failed While Pushing Into Collection")
									}
								});
							}
							else {
								alert("Post added successfully")
								this.reset();
								this.getPosts();
							}
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


	onImageLoad(height: number, width: number) {
		this.currentImageHeight.set(height);
		this.currentImageWidth.set(width);
	}

	reset() {
		this.imageTag.nativeElement.value = null;
		this.imageFile = null;
		this.editMode.set(false);
		this.alternate_text = "";
		this.title = '';
		this.desc = '';
		this.priority = 11;
		this.body = '';
		this.identifier = '';
		this.location = '';
		this.addToCollection.set(false);
		this.previewUrl.set(null);
		window.scrollTo(0, 0);
	}

	uploadFiles(fileExtension: string, ogFile: File): Promise<string> {

		return new Promise((resolve, reject) => {

			const dropboxPath = "/Posts/" + this.identifier.trim().replaceAll(" ", "_").toLowerCase() + fileExtension;

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
					else if (this.editMode()) {
						resolve(this.selectedPost().imageUrl);
					}
				},
				error: err1 => {
					reject("Upload failed: " + err1);
				}
			});
		});
	}

	async addToCollectionSelected() {
		if (!this.previewUrl()) {
			setTimeout(() => {
				alert("Please add Image");
				this.addToCollection.set(false);
			}, 1);
		}
	}

	editPost(item: any) {
		this.http.post<boolean>('https://dashing-llama-639318.netlify.app/.netlify/functions/addPost', {
			location: item.location,
			isCollection: item.isCollection,
			imageUrl: item.imageUrl,
			caption: item.caption,
			identifier: item.identifier,
			title: item.title,
			postBody: item.postBody,
			timestamp: new Date(),
			imageExt: item.imageExt,
			password: this.stateService.password(),
			height: this.currentImageHeight(),
			width: this.currentImageWidth()
		}).subscribe({
			next: (data) => {
				alert("Post Updated");
				this.getPosts();
			},
			error: (err: any) => {
				alert("Oops ! Error Occured")
			}
		})
	}

	async deletePost(item: any) {
		if (this.stateService.loggedIn()) {
			if (confirm("Are you sure you want to delete ?")) {
				this.ongoing.set(true);
				if (item.imageUrl != '' && !item.isCollection)
					await this.deleteFromDropbox(`/Posts/${item.identifier}${item.imageExt}`)
				this.http.post("https://dashing-llama-639318.netlify.app/.netlify/functions/deletePost", {
					"customName": item.identifier,
					"password": this.stateService.password()
				}).subscribe({
					next: res => {
						this.getPosts();
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
}
