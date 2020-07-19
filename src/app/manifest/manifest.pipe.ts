import { Pipe, PipeTransform } from '@angular/core';
import { ManifestService } from './manifest.service';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Pipe({
  name: 'manifest',
})
export class ManifestPipe implements PipeTransform {
  constructor(private manifestService: ManifestService) {}

  transform(hash: number, type: string): Observable<string> {
    return this.manifestService.state$.pipe(
      map((state) => {
        if (state.loaded) {
          switch (type) {
            case 'race':
              return this.manifestService.defs.DestinyRace.get(hash).displayProperties.name;
            case 'class':
              return this.manifestService.defs.DestinyClass.get(hash).displayProperties.name;
            case 'emblemSecondarySpecial':
              return `https://bungie.net${this.manifestService.defs.InventoryItem.get(hash).secondarySpecial}`;
            case 'activityName':
              return this.manifestService.defs.Activity.get(hash).displayProperties.name;
            case 'activityMode':
              return this.manifestService.defs.Activity.get(hash).displayProperties.name;
            case 'activityIcon':
              return this.manifestService.defs.Activity.get(hash).displayProperties.hasIcon
                ? `https://bungie.net${this.manifestService.defs.Activity.get(hash).displayProperties.icon}`
                : ``;
            case 'emblemHash':
              return `https://bungie.net${this.manifestService.defs.InventoryItem.get(hash).displayProperties.icon}`;
            default:
              return '';
          }
        }
      })
    );
  }
}
