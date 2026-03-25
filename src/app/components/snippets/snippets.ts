import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { State } from '../../services/state';
import { FormsModule } from '@angular/forms';
import { DatePipe, NgClass } from '@angular/common';
import { environment } from '../../../environment/environment';

@Component({
	selector: 'app-snippets',
	imports: [FormsModule, NgClass, DatePipe],
	templateUrl: './snippets.html',
	styleUrl: './snippets.scss',
})
export class Snippets {
	// snippets = signal<any>([
	// 	{
	// 		"title": 'Code to Copy',
	// 		"timeStamp": new Date(),
	// 		"codeBlocks": [
	// 			{
	// 				"language": 'python',
	// 				"code": `name = input('What is your name? ')
	// print(f'Hi, {name}.')`,
	// 				"title": 'Hello World',
	// 				"explanation": 'Hello world 2'
	// 			},

	// 			{
	// 				"language": 'python',
	// 				"code": `name = input('What is your name? ')
	// print(f'Hi, {name}.')`,
	// 				"title": 'Hello World',
	// 				"explanation": 'Hello world 2'
	// 			}
	// 		]
	// 	},

	// 	{
	// 		"title": 'Code to Copy',
	// 		"timeStamp": new Date(),
	// 		"codeBlocks": [
	// 			{
	// 				"language": 'css',
	// 				"code": `name = input('What is your name? ')
	// print(f'Hi, {name}.')`,
	// 				"title": 'Hello World',
	// 				"explanation": '',
	// 			}
	// 		]
	// 	}
	// ]);

	title = signal<string>('');
	error = signal<string[]>([]);
	editMode = signal<boolean>(false);
	ongoing = signal<boolean>(false);
	identifier = signal<string>('');
	codeBlock = signal<{
		language: string,
		code: string,
		filename: string,
		explanation: string
	}[]>([{
		code: '',
		explanation: '',
		filename: '',
		language: ''
	}]);

	snippets = signal<any>([]);

	constructor(private http: HttpClient, public stateService: State) { }

	ngOnInit() {
		this.getSnippets();
	}

	reset() {
		this.title.set('');
		this.error.set([]);
		this.editMode.set(false);
		this.ongoing.set(false);
		this.identifier.set('');
		this.codeBlock.set([{
			code: '',
			explanation: '',
			filename: '',
			language: ''
		}]);
	}

	uploadSnippet() {
		this.error.set([]);

		if (this.identifier().trim() == '')
			this.error.update(val => [...val, "Identifier is missing"])

		if (this.title().trim() == '')
			this.error.update(val => [...val, "Title is missing"])

		this.codeBlock().forEach((element, index) => {
			if (element.filename.trim() == '')
				this.error.update(val => [...val, "Filename is missing in Code Block " + (index + 1)]);

			if (element.language.trim() == '')
				this.error.update(val => [...val, "Language is missing in Code Block " + (index + 1)]);

			if (element.code.trim() == '')
				this.error.update(val => [...val, "Code is missing in Code Block " + (index + 1)]);

			if (element.explanation.trim() == '')
				this.error.update(val => [...val, "Explanation is missing in Code Block " + (index + 1)]);
		});

		if (this.error().length != 0)
			window.scrollTo(0, 0);

		if (this.error().length == 0 && this.stateService.loggedIn()) {
			if (confirm("Are you sure you want to submit ?")) {
				this.ongoing.set(true);

				const headers = new HttpHeaders({
					'Content-Type': 'application/json',
					'X-Site-Identity': 'portfolio-admin-v1'
				});

				this.http.post<boolean>(environment.domain + '.netlify/functions/addSnippet', {
					"identifier": this.identifier().trim().replaceAll(" ", "_").toLowerCase(),
					"title": this.title(),
					"codeBlocks": this.codeBlock(),
					"password": this.stateService.password(),
				}, { headers }).subscribe({
					next: (data) => {
						alert("Snippet added successfully");
						this.reset();
						this.getSnippets();
					},
					error: (err) => {
						alert("Error while uploading snippet")
					},
					complete: () => {
						this.ongoing.set(false);
					}
				});

			}
		} else if (!this.stateService.loggedIn() && this.error().length == 0) {
			alert("Kindly Login");
		}
	}

	addCodeBlock() {
		this.codeBlock.update(val => [...val, {
			code: '',
			explanation: '',
			filename: '',
			language: ''
		}])
	}

	async copyCode(block: any) {
		try {
			await navigator.clipboard.writeText(block.code);
			block.copyStatus = 'copied';
		} catch (err) {
			block.copyStatus = 'error';
		}
	}

	deleteSnippet(identifier: string) {

		if (!this.stateService.loggedIn()) {
			alert("Kindly Login");
		}
		else {
			const headers = new HttpHeaders({
				'Content-Type': 'application/json',
				'X-Site-Identity': 'portfolio-admin-v1'
			});

			this.http.post<any>(environment.domain + '.netlify/functions/deleteSnippet', { 'identifier': identifier, 'password': this.stateService.password() }, { headers }).subscribe({
				next: data => {
					alert("Deleted Successfully");
					this.getSnippets();
				},
				error: err => {
					alert("Error fetching data");
				}
			});
		}

	}

	getSnippets() {
		const headers = new HttpHeaders({
			'Content-Type': 'application/json',
			'X-Site-Identity': 'portfolio-admin-v1'
		});

		this.http.get<any>(environment.domain + '.netlify/functions/getSnippets', { headers }).subscribe({
			next: data => {
				this.snippets.set(data);
			},
			error: err => {
				this.snippets.set([]);
			}
		});
	}

}
