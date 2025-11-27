import { Pipe, PipeTransform } from '@angular/core';
import { Song } from '../interfaces/song';

@Pipe({
	name: 'sort'
})
export class SortPipe implements PipeTransform {

	transform(value: Song[], direction: string, factor: string): Song[] {
		if (direction == 'asc')
			return value.sort((a: any, b: any) => a[factor] - b[factor]);
		else
			return value.sort((a : any, b : any) => b[factor] - a[factor]);
	}

}
