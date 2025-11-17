import { Injectable, signal } from '@angular/core';

@Injectable({
	providedIn: 'root',
})
export class State {
	loggedIn = signal<boolean>(false);
	password = signal<string>('');
	dropbox_access_token = signal<string>('');
}
