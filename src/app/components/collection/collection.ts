import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, ElementRef, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { State } from '../../services/state';
import { environment } from '../../../environment/environment';

interface ICollection {
	altText: string;
	description: string;
	height: number;
	identifier: string;
	location: string;
	priority: number;
	url: string;
	password: string;
	uploadDate: string;
	imageExt: string;
	folder: string
}

@Component({
	selector: 'app-collection',
	imports: [FormsModule],
	templateUrl: './collection.html',
	styleUrl: './collection.scss',
})

export class Collection {
	error: string[] = [];
	previewUrl = signal<any>(null);
	imageFile: any = null;
	desc: string = "";
	sortCriteria: string = 'uploadDate';
	sortSeries: string = 'desc';
	editable = signal<boolean>(false);
	identifier: string = "";
	location: string = "";
	holdEdit = signal<boolean>(false);
	alternate_text: string = "";
	priority: number = 1;
	image_list = signal<number[]>([]);
	collection_list = signal<any[]>([]);
	ongoing = signal<boolean>(false);
	editMode = signal<boolean>(false);
	currentImageHeight = signal<number>(0);
	currentImageWidth = signal<number>(0);
	previewImageFolder = signal<string>('');
	unique_identifer = signal<string[]>([]);
	previewImageExt = signal<string>('');
	selectedCollection = signal<ICollection>({
		altText: '',
		description: '',
		height: 0,
		identifier: '',
		location: '',
		password: '',
		priority: 0,
		uploadDate: '',
		url: '',
		imageExt: '',
		folder: 'Collection'
	});
	left = signal<any>([]);
	right = signal<any>([]);

	@ViewChild("imageTag") imageTag!: ElementRef;

	imageTagChange(event: any) {
		this.imageFile = event.target.files[0];
		const reader = new FileReader();
		reader.onload = () => {
			this.previewUrl.set(reader.result);
		};
		reader.readAsDataURL(this.imageFile);
	}

	constructor(public stateService: State, private http: HttpClient) { }

	ngOnInit() {
		this.fetchData();
	}

	fetchData() {

		const headers = new HttpHeaders({
			'Content-Type': 'application/json',
			'X-Site-Identity': 'portfolio-admin-v1'
		});

		this.http.get<any>(environment.domain+'.netlify/functions/getCollection', { headers }).subscribe({
			next: data => {
				this.collection_list.set(data);
				this.collection_list().sort((a, b) => a.priority - b.priority);
				this.unique_identifer.set(data.map((d: any) => d.identifier))
				this.image_list.set(Array.from({ length: data.length + 1 }, (v, i) => i));
				this.hydrate(this.collection_list());
			}
		});
	}

	hydrate(data: any) {
		let arr1: any[] = [];
		let arr2: any[] = [];
		let leftH = 0;
		let rightH = 0;
		data.forEach((img: any) => {
			if (leftH <= rightH) {
				leftH += img.height;
				arr1.push(img);
			} else {
				rightH += img.height;
				arr2.push(img);
			}
		});

		this.left.set(arr1);
		this.right.set(arr2);
	}

	updatePriority(item: ICollection) {
		this.holdEdit.set(true);

		const headers = new HttpHeaders({
			'Content-Type': 'application/json',
			'X-Site-Identity': 'portfolio-admin-v1'
		});

		this.http.post<boolean>(environment.domain+'.netlify/functions/addToCollection', { ...item, password: this.stateService.password() }, { headers }).subscribe({
			next: (data) => {
				this.holdEdit.set(false);
				this.fetchData();
			},
		});
	}

	reset() {
		this.imageTag.nativeElement.value = null;
		this.imageFile = null;
		this.desc = "";
		this.identifier = "";
		this.location = "";
		this.alternate_text = "";
		this.editMode.set(false);
		this.previewUrl.set(null);
		this.previewImageExt.set('');
		this.previewImageFolder.set('');
		this.priority = 1;
		this.editable.set(false);
		this.error = [];
		window.scrollTo(0, 0);
	}

	onImageLoad(height: number, width: number) {
		this.currentImageHeight.set(height);
		this.currentImageWidth.set(width);
	}

	selectEditable(item: ICollection) {
		this.editMode.set(true);
		this.previewImageExt.set(item.imageExt);
		this.previewImageFolder.set(item.folder);
		this.previewUrl.set(item.url);
		this.alternate_text = item.altText;
		this.desc = item.description;
		this.identifier = item.identifier;
		this.location = item.location;
		this.priority = item.priority;
		window.scrollTo(0, 0);
	}

	async uploadToCollection() {
		this.error = [];

		if (!this.imageFile && !this.editMode())
			this.error.push("Image is missing")

		if (this.desc.trim() == '')
			this.error.push("Description is missing")

		if (this.identifier.trim() == '')
			this.error.push("Identifier is missing")

		if (this.location.trim() == '')
			this.error.push("Location is missing")

		if (this.alternate_text.trim() == '')
			this.error.push("Alternate Text is missing")

		if (this.unique_identifer().includes(this.identifier.trim().replaceAll(" ", "_").toLowerCase()) && !this.editMode())
			this.error.push("Duplicate Identifier")

		if (this.error.length != 0)
			window.scrollTo(0, 0);

		if (this.error.length == 0 && this.stateService.loggedIn()) {
			if (confirm("Are you sure you want to submit ?")) {
				this.ongoing.set(true);
				try {
					const previewImageFolder = this.previewImageFolder() == '' ? 'Collection' : this.previewImageFolder();
					const imageExt = this.previewImageExt() == '' ? "." + this.imageFile.name.split(".")[1] : this.previewImageExt();
					const imageUrl = this.imageFile ? await this.uploadFiles(imageExt, this.imageFile) : this.previewUrl();


					const headers = new HttpHeaders({
						'Content-Type': 'application/json',
						'X-Site-Identity': 'portfolio-admin-v1'
					});

					this.http.post<boolean>(environment.domain+'.netlify/functions/addToCollection', {
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
						folder: previewImageFolder
					}, { headers }).subscribe({
						next: (data) => {
							this.reset();
							alert("Image File Uploaded SuccessFully")
							this.fetchData();
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

	async deleteItem(item: any) {
		if (this.stateService.loggedIn()) {
			if (confirm("Are you sure you want to submit ?")) {
				this.ongoing.set(true);
				const folder = 'folder' in item ? item.folder : 'Collection';
				await this.deleteFromDropbox(`/${folder}/${item.identifier}${item.imageExt}`)

				const headers = new HttpHeaders({
					'Content-Type': 'application/json',
					'X-Site-Identity': 'portfolio-admin-v1'
				});

				this.http.post(environment.domain+".netlify/functions/deleteCollection", {
					"customName": item.identifier,
					"password": this.stateService.password()
				}, { headers }).subscribe({
					next: res => {
						this.fetchData();
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

			const dropboxPath = "/Collection/" + this.identifier.trim().replaceAll(" ", "_").toLowerCase() + fileExtension;

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
						resolve(this.selectedCollection().url);
					}


				},
				error: err1 => {
					reject("Upload failed: " + err1);
				}
			});

		});
	}
}
