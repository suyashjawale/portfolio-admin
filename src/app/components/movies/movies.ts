import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { State } from '../../services/state';

@Component({
    selector: 'app-movies',
    imports: [FormsModule],
    templateUrl: './movies.html',
    styleUrl: './movies.scss',
})
export class Movies {
    error: string[] = [];
    link = signal<string>('');
    name = signal<string>('');
    ongoing = signal<boolean>(false);
    constructor(private http: HttpClient, public stateService: State) { }
    postMovie() {
        this.error = [];

        if (this.link().trim() == '')
            this.error.push("Link is missing")


        if (this.name().trim() == '')
            this.error.push("Name is missing")

        if (this.error.length != 0)
            window.scrollTo(0, 0);

        if (this.error.length == 0 && this.stateService.loggedIn()) {
            if (confirm("Are you sure you want to submit ?")) {
                this.ongoing.set(true);

                const headers = new HttpHeaders({
                    'Content-Type': 'application/json',
                    'X-Site-Identity': 'portfolio-admin-v1'
                });

                const payload = {
                    "name": this.name(),
                    "link": this.link(),
                    "password": this.stateService.password()
                }

                this.http.post('https://dashing-llama-639318.netlify.app/.netlify/functions/addMovie', payload, { headers }).subscribe({
                    next: (data) => {
                        this.reset();
                    },
                    error: err => {

                    },
                    complete: () => {
                        this.ongoing.set(false);
                    }
                });
            }
        }
        else if (!this.stateService.loggedIn() && this.error.length == 0) {
            alert("Kindly Login");
        }
    }

    reset() {
        this.link.set('');
        this.name.set('');
    }
}
