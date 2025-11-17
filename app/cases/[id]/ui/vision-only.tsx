interface Props {
  caseData: any;
}

export default function VisionOnlyWorkspace({ caseData }: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">Vision Analysis</h2>
      <p className="text-sm text-slate-600">
        Vision analysis module (photo + video) will be implemented here.
      </p>
    </div>
  );
}
