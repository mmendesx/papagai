import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TuiAlertService, TuiDialogService } from '@taiga-ui/core';
import { TuiConfirmService } from '@taiga-ui/kit/components/confirm';
import { EMPTY, of } from 'rxjs';
import { ApiKeysService } from '../../core/services/api-keys.service';
import { HeaderActionsService } from '../../shared/header-actions.service';
import { ApikeysComponent } from './apikeys.component';

describe(ApikeysComponent.name, () => {
  let fixture: ComponentFixture<ApikeysComponent>;
  let apiKeysService: jasmine.SpyObj<ApiKeysService>;
  let dialogs: jasmine.SpyObj<TuiDialogService>;

  beforeEach(async () => {
    apiKeysService = jasmine.createSpyObj<ApiKeysService>('ApiKeysService', [
      'listAccountKeys',
      'revokeAccountKey',
    ]);
    apiKeysService.listAccountKeys.and.returnValue(of([]));

    dialogs = jasmine.createSpyObj<TuiDialogService>('TuiDialogService', [
      'open',
    ]);

    await TestBed.configureTestingModule({
      imports: [ApikeysComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ApiKeysService, useValue: apiKeysService },
        { provide: TuiDialogService, useValue: dialogs },
        {
          provide: TuiConfirmService,
          useValue: { withConfirm: jasmine.createSpy('withConfirm') },
        },
        {
          provide: TuiAlertService,
          useValue: { open: jasmine.createSpy('open').and.returnValue(EMPTY) },
        },
        {
          provide: HeaderActionsService,
          useValue: {
            setActions: jasmine.createSpy('setActions'),
            clearActions: jasmine.createSpy('clearActions'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApikeysComponent);
  });

  it('displays the newly created key without replacing it with an empty reload', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance.keys()).toEqual([]);

    dialogs.open.and.returnValue(
      of({
        id: 'key-1',
        name: 'Production key',
        prefix: 'ppg_acct_ab',
        key: 'ppg_acct_secret',
        enabled: true,
        createdAt: '2026-05-16T00:00:00.000Z',
        permissions: ['instances:list'],
      }),
    );

    fixture.componentInstance.openCreate();

    expect(apiKeysService.listAccountKeys).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.keys()).toEqual([
      {
        id: 'key-1',
        name: 'Production key',
        prefix: 'ppg_acct_ab',
        enabled: true,
        createdAt: '2026-05-16T00:00:00.000Z',
        permissions: ['instances:list'],
      },
    ]);
  });
});
