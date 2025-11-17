import { Routes } from '@angular/router';
import { Music } from './components/music/music';
import { Birthday } from './components/birthday/birthday';

export const routes: Routes = [
    {
        path: "",
        redirectTo: 'music',
        pathMatch: 'full'
    },
    {
        path: 'music',
        component: Music
    },
    {
        path: 'birthday',
        component: Birthday
    }
];
