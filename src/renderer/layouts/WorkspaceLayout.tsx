import type { ReactNode } from 'react';

type WorkSpaceLayoutProps = {
  navigation: ReactNode;
  notes: ReactNode;
  editor: ReactNode;
  preview: ReactNode;
};

export const WorkSpaceLayout = ({
  navigation,
  notes,
  editor,
  preview,
}: WorkSpaceLayoutProps) => {
  return (
    <>
      <div className="workspace">
        <aside className="workspace__navigation">{navigation}</aside>
        <section className="workspace__notes">{notes}</section>
        <section className="workspace__editor">{editor}</section>
        <section className="workspace__preview">{preview}</section>
      </div>
    </>
  );
};
