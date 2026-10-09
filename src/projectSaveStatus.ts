export type ProjectSaveFailure = {
  reason: 'quota' | 'blocked' | 'serialization' | 'unknown';
  errorName: string;
  textBytes?: number;
};
let failure: ProjectSaveFailure | null = null;
export function getProjectSaveFailure(): ProjectSaveFailure | null { return failure; }

// Report the actual failing stage. Do not log project text, images or other user data.
export function saveProjectData(key: string, projects: unknown): boolean {
  let serialized: string;
  try {
    serialized = JSON.stringify(projects);
    if (typeof serialized !== 'string') throw new TypeError('Invalid project data');
  } catch (error) {
    failure = { reason: 'serialization', errorName: errorName(error) };
    return false;
  }
  try {
    localStorage.setItem(key, serialized);
    failure = null;
    return true;
  } catch (error) {
    const name = errorName(error);
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    const quota = name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
    failure = { reason: quota ? 'quota' : name === 'SecurityError' ? 'blocked' : 'unknown', errorName: name, textBytes: serialized.length * 2 };
    return false;
  }
}
function errorName(error: unknown): string {
  return error && typeof error === 'object' && 'name' in error && typeof error.name === 'string' ? error.name : 'UnknownError';
}

export function projectSaveErrorText(error: ProjectSaveFailure, locale: string): string {
  const sv = locale === 'sv', nb = locale === 'nb';
  const cause = error.reason === 'quota'
    ? sv ? 'Appens textlagring (localStorage) har nått sin lagringsgräns. Det är en separat gräns från ledigt diskutrymme och webbläsarens övriga lagring.' : nb ? 'Appens tekstlagring (localStorage) har nådd lagringsgrensen. Dette er en egen grense, uavhengig av ledig diskplass og nettleserens øvrige lagring.' : 'The app’s text storage (localStorage) reached its storage limit. This is separate from free disk space and other browser storage.'
    : error.reason === 'blocked'
      ? sv ? 'Webbläsaren blockerar åtkomst till appens lokala lagring.' : nb ? 'Nettleseren blokkerer tilgang til appens lokale lagring.' : 'The browser is blocking access to the app’s local storage.'
      : error.reason === 'serialization'
        ? sv ? 'Projektdata kunde inte omvandlas till sparformatet.' : nb ? 'Prosjektdata kunne ikke konverteres til lagringsformatet.' : 'Project data could not be converted to the save format.'
        : sv ? 'Ett fel inträffade vid skrivning till appens lokala lagring.' : nb ? 'Det oppsto en feil ved skriving til appens lokale lagring.' : 'Writing to the app’s local storage failed.';
  const size = error.textBytes === undefined ? '' : ` ${sv ? 'Projektdata' : nb ? 'Prosjektdata' : 'Project data'}: ~${(error.textBytes / 1048576).toFixed(2)} MiB ${sv ? 'text' : nb ? 'tekst' : 'of text'}.`;
  return (sv ? 'Projektet kunde inte sparas. ' : nb ? 'Prosjektet kunne ikke lagres. ' : 'The project could not be saved. ') + cause + ` (${error.errorName}).` + size + ' ' + (sv ? 'Ändringarna finns kvar i den öppna appen. Exportera en albumbackup innan du laddar om eller stänger.' : nb ? 'Endringene finnes fortsatt i den åpne appen. Eksporter en albumbackup før du laster på nytt eller lukker.' : 'Your edits remain in the open app. Export an album backup before reloading or closing.');
}
