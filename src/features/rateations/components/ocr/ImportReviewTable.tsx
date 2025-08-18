import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Plus, Save, X } from 'lucide-react';
import type { ParsedInstallment } from './types';
import { formatEuro } from '@/lib/formatters';
import { formatISOToItalian, isValidISODate } from '@/utils/date';

interface ImportReviewTableProps {
  installments: ParsedInstallment[];
  onConfirm: (installments: ParsedInstallment[]) => void;
  onCancel: () => void;
}

export const ImportReviewTable = ({ installments, onConfirm, onCancel }: ImportReviewTableProps) => {
  const [data, setData] = useState<ParsedInstallment[]>(installments);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<ParsedInstallment>>({});

  const total = data.reduce((sum, item) => sum + item.amount, 0);
  const validCount = data.filter(item => item.amount > 0 && item.due_date).length;

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...data[index] });
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && editForm) {
      const updated = [...data];
      updated[editingIndex] = { ...updated[editingIndex], ...editForm };
      setData(updated);
      setEditingIndex(null);
      setEditForm({});
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditForm({});
  };

  const handleDelete = (index: number) => {
    const updated = data.filter((_, i) => i !== index);
    setData(updated);
  };

  const handleAdd = () => {
    const newInstallment: ParsedInstallment = {
      seq: data.length + 1,
      due_date: '',
      amount: 0,
      description: '',
      notes: 'Aggiunta manualmente',
    };
    setData([...data, newInstallment]);
    setEditingIndex(data.length);
    setEditForm(newInstallment);
  };

  const handleConfirm = () => {
    const validInstallments = data.filter(item => 
      item.amount > 0 && 
      item.due_date && 
      !isNaN(new Date(item.due_date).getTime())
    );
    onConfirm(validInstallments);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Riepilogo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{data.length}</div>
              <div className="text-sm text-muted-foreground">Rate Totali</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{validCount}</div>
              <div className="text-sm text-muted-foreground">Rate Valide</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatEuro(total)}</div>
              <div className="text-sm text-muted-foreground">Totale</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Rate Estratte</h3>
            <Button onClick={handleAdd} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi
            </Button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seq</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead>Importo</TableHead>
                <TableHead>Tributo</TableHead>
                <TableHead>Anno</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {editingIndex === index ? (
                      <Input
                        type="number"
                        value={editForm.seq || ''}
                        onChange={(e) => setEditForm({ ...editForm, seq: parseInt(e.target.value) || 0 })}
                        className="w-16"
                      />
                    ) : (
                      item.seq
                    )}
                  </TableCell>
                  
                   <TableCell>
                     {editingIndex === index ? (
                       <Input
                         type="date"
                         value={isValidISODate(editForm.due_date ?? '') ? editForm.due_date : ''}
                         onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                       />
                     ) : (
                       <div>
                         {formatISOToItalian(item.due_date)}
                         {!item.due_date && <Badge variant="destructive" className="ml-2">Mancante</Badge>}
                       </div>
                     )}
                   </TableCell>
                  
                  <TableCell>
                    {editingIndex === index ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.amount || ''}
                        onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })}
                      />
                    ) : (
                      <div>
                        {formatEuro(item.amount)}
                        {item.amount <= 0 && <Badge variant="destructive" className="ml-2">Non valido</Badge>}
                      </div>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {editingIndex === index ? (
                      <Input
                        value={editForm.tributo || ''}
                        onChange={(e) => setEditForm({ ...editForm, tributo: e.target.value })}
                        placeholder="IMU, TASI..."
                      />
                    ) : (
                      item.tributo || '-'
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {editingIndex === index ? (
                      <Input
                        value={editForm.anno || ''}
                        onChange={(e) => setEditForm({ ...editForm, anno: e.target.value })}
                        placeholder="2024"
                      />
                    ) : (
                      item.anno || '-'
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {editingIndex === index ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(index)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button 
          onClick={handleConfirm}
          disabled={validCount === 0}
        >
          Conferma {validCount} Rate
        </Button>
      </div>
    </div>
  );
};