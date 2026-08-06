import { supabase } from './supabaseClient';

export interface DocumentTypeDefinition {
  id: string;
  name: string;
  englishName: string;
  note: string;
  fileType: string;
  allowMultiple: boolean;
  isActive: boolean;
  isRequired: boolean;
  sortOrder: number;
}

const mapDocumentType = (row: any): DocumentTypeDefinition => ({
  id: row.id,
  name: row.name,
  englishName: row.english_name || '',
  note: row.note || '',
  fileType: row.file_type,
  allowMultiple: Boolean(row.allow_multiple),
  isActive: Boolean(row.is_active),
  isRequired: Boolean(row.is_required),
  sortOrder: Number(row.sort_order) || 0,
});

export const documentTypeService = {
  async getAll(): Promise<DocumentTypeDefinition[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('document_types')
      .select('id, name, english_name, note, file_type, allow_multiple, is_active, is_required, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapDocumentType);
  },

  async save(documentType: Omit<DocumentTypeDefinition, 'id'> & { id?: string }): Promise<DocumentTypeDefinition> {
    if (!supabase) {
      throw new Error('Veritabanı bağlantısı bulunamadı.');
    }

    const payload = {
      name: documentType.name.trim(),
      english_name: documentType.englishName.trim(),
      note: documentType.note.trim(),
      file_type: documentType.fileType.trim(),
      allow_multiple: documentType.allowMultiple,
      is_active: documentType.isActive,
      is_required: documentType.isRequired,
      sort_order: documentType.sortOrder,
    };

    const query = documentType.id
      ? supabase.from('document_types').update(payload).eq('id', documentType.id)
      : supabase.from('document_types').insert(payload);
    const { data, error } = await query
      .select('id, name, english_name, note, file_type, allow_multiple, is_active, is_required, sort_order')
      .single();

    if (error) throw error;
    return mapDocumentType(data);
  },

  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Veritabanı bağlantısı bulunamadı.');

    const { error } = await supabase.from('document_types').delete().eq('id', id);
    if (error) throw error;
  }
};
