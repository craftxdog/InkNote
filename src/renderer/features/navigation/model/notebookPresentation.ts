type NotebookIdentity = Readonly<{
  id: string;
  name: string;
}>;

export type NotebookPurpose = 'inbox' | 'learn' | 'notes' | 'project' | 'work';

const termsForPurpose: Readonly<
  Record<Exclude<NotebookPurpose, 'notes'>, readonly string[]>
> = {
  inbox: ['inbox'],
  learn: ['learn', 'reading', 'research', 'study'],
  project: ['project', 'launch', 'build'],
  work: ['work', 'office', 'client'],
};

export const notebookPurposeFor = ({
  id,
  name,
}: NotebookIdentity): NotebookPurpose => {
  const searchableName = `${id} ${name}`.toLocaleLowerCase();

  for (const [purpose, terms] of Object.entries(termsForPurpose) as [
    Exclude<NotebookPurpose, 'notes'>,
    readonly string[],
  ][]) {
    if (terms.some((term) => searchableName.includes(term))) {
      return purpose;
    }
  }

  return 'notes';
};
