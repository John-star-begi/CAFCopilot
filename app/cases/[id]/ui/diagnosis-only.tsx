interface Props {
  caseData: any;
}

export default function DiagnosisOnlyWorkspace({ caseData }: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">Diagnosis Only</h2>
      <p className="text-sm text-slate-600">
        Diagnosis module will be implemented here.
      </p>
    </div>
  );
}
