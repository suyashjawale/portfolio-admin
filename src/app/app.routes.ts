import { Routes } from '@angular/router';
import { Music } from './components/music/music';
import { Birthday } from './components/birthday/birthday';
import { Collection } from './components/collection/collection';
import { Posts } from './components/posts/posts';

export const routes: Routes = [
    {
        path: "",
        redirectTo: 'posts',
        pathMatch: 'full'
    },
    {
        path: 'music',
        component: Music
    },
    {
        path: 'birthday',
        component: Birthday
    },
    {
        path: 'collection',
        component: Collection
    },
    {
        path: 'posts',
        component: Posts
    }
];
