import { Component, signal } from '@angular/core';
import { FormsModule, NgModel } from '@angular/forms';
import { Router, RouterOutlet } from '@angular/router';
import { State } from './services/state';
import { HttpClient } from '@angular/common/http';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, FormsModule],
	templateUrl: './app.html',
	styleUrl: './app.scss'
})
export class App {
	screenName: string = 'music';
	constructor(private router: Router, public stateService: State, private http: HttpClient) { }

	switchToScreen() {
		this.router.navigate(['/' + this.screenName])
	}

	openAuthenticationDialog() {
		let input = prompt("Please enter password");

		if (input != null && input != undefined && input != "") {
			this.http.post<boolean>('https://dashing-llama-639318.netlify.app/.netlify/functions/authenticate', {
				password: input
			}).subscribe({
				next: (data:any) => {
					this.stateService.loggedIn.set(true);
					this.stateService.password.set(input);
					this.stateService.dropbox_access_token.set(data.access_token);
				},
				error: (error) => {
					alert(error.error);
				}
			});
		}
	}
}
