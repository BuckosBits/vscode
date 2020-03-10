/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQuickPickSeparator } from 'vs/platform/quickinput/common/quickInput';
import { IQuickPickItemRunnable, PickerQuickAccessProvider } from 'vs/platform/quickinput/common/quickAccess';
import { CancellationToken } from 'vs/base/common/cancellation';
import { localize } from 'vs/nls';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { VIEWLET_ID, IExtensionsViewPaneContainer } from 'vs/workbench/contrib/extensions/common/extensions';
import { IExtensionGalleryService, IExtensionManagementService, IGalleryExtension } from 'vs/platform/extensionManagement/common/extensionManagement';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { ILogService } from 'vs/platform/log/common/log';

export class InstallExtensionQuickAccessProvider extends PickerQuickAccessProvider<IQuickPickItemRunnable> {

	static PREFIX = 'ext install ';

	constructor(
		@IViewletService private readonly viewletService: IViewletService,
		@IExtensionGalleryService private readonly galleryService: IExtensionGalleryService,
		@IExtensionManagementService private readonly extensionsService: IExtensionManagementService,
		@INotificationService private readonly notificationService: INotificationService,
		@ILogService private readonly logService: ILogService
	) {
		super(InstallExtensionQuickAccessProvider.PREFIX);
	}

	protected getPicks(filter: string, token: CancellationToken): Array<IQuickPickItemRunnable | IQuickPickSeparator> | Promise<Array<IQuickPickItemRunnable | IQuickPickSeparator>> {

		// Nothing typed
		if (!filter) {
			return [{
				label: localize('type', "Type an extension name to install or search.")
			}];
		}

		const genericSearchPickItem: IQuickPickItemRunnable = {
			label: localize('searchFor', "Press Enter to search for extension '{0}'.", filter),
			run: () => this.searchExtension(filter)
		};

		// Extension ID typed: try to find it
		if (/\./.test(filter)) {
			return this.getPicksForExtensionId(filter, genericSearchPickItem, token);
		}

		// Extension name typed: offer to search it
		else {
			return [genericSearchPickItem];
		}
	}

	protected async getPicksForExtensionId(filter: string, fallback: IQuickPickItemRunnable, token: CancellationToken): Promise<Array<IQuickPickItemRunnable | IQuickPickSeparator>> {
		try {
			const galleryResult = await this.galleryService.query({ names: [filter], pageSize: 1 }, token);
			if (token.isCancellationRequested) {
				return []; // return early if canceled
			}

			const galleryExtension = galleryResult.firstPage[0];
			if (!galleryExtension) {
				return [fallback];
			} else {
				return [{
					label: localize('install', "Press Enter to install extension '{0}'.", filter),
					run: () => this.installExtension(galleryExtension, filter)
				}];
			}
		} catch (error) {
			if (token.isCancellationRequested) {
				return []; // expected error
			}

			this.logService.error(error);

			return [fallback];
		}
	}

	private async installExtension(extension: IGalleryExtension, name: string): Promise<void> {
		try {
			await openExtensionsViewlet(this.viewletService, `@id:${name}`);
			await this.extensionsService.installFromGallery(extension);
		} catch (error) {
			this.notificationService.error(error);
		}
	}

	private async searchExtension(name: string): Promise<void> {
		openExtensionsViewlet(this.viewletService, name);
	}
}

export class ManageExtensionsQuickAccessProvider extends PickerQuickAccessProvider<IQuickPickItemRunnable> {

	static PREFIX = 'ext ';

	constructor(@IViewletService private readonly viewletService: IViewletService) {
		super(ManageExtensionsQuickAccessProvider.PREFIX);
	}

	protected getPicks(): Array<IQuickPickItemRunnable | IQuickPickSeparator> {
		return [{
			label: localize('manage', "Press Enter to manage your extensions."),
			run: () => openExtensionsViewlet(this.viewletService)
		}];
	}
}

async function openExtensionsViewlet(viewletService: IViewletService, search = ''): Promise<void> {
	const viewlet = await viewletService.openViewlet(VIEWLET_ID, true);
	const view = viewlet?.getViewPaneContainer() as IExtensionsViewPaneContainer | undefined;
	view?.search(search);
	view?.focus();
}