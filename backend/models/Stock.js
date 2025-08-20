import getPool from '../config/database.js';

class Stock {
    static async create(stockData) {
        try {
            const db = await getPool();
            const { code, name, market, board, industry } = stockData;
            
            // 使用 INSERT ... ON DUPLICATE KEY UPDATE 语法
            // 如果股票代码已存在，则更新其他信息
            const [result] = await db.execute(
                `INSERT INTO stocks (code, name, market, board, industry) 
                 VALUES (?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE 
                 name = VALUES(name), 
                 market = VALUES(market), 
                 board = VALUES(board),
                 industry = VALUES(industry),
                 updated_at = CURRENT_TIMESTAMP`,
                [code, name, market, board, industry]
            );
            
            // 返回插入的ID或更新的行数
            return result.insertId || result.affectedRows;
        } catch (error) {
            throw error;
        }
    }

    static async findAll() {
        try {
            const db = await getPool();
            const [rows] = await db.execute('SELECT * FROM stocks ORDER BY code');
            return rows;
        } catch (error) {
            throw error;
        }
    }

    static async findByCode(code) {
        try {
            const db = await getPool();
            const [rows] = await db.execute('SELECT * FROM stocks WHERE code = ?', [code]);
            return rows[0] || null;
        } catch (error) {
            throw error;
        }
    }

    static async findByBoard(board) {
        try {
            const db = await getPool();
            const [rows] = await db.execute('SELECT * FROM stocks WHERE board = ? ORDER BY code', [board]);
            return rows;
        } catch (error) {
            throw error;
        }
    }

    static async getBoardStatistics() {
        try {
            const db = await getPool();
            const [rows] = await db.execute(`
                SELECT board, COUNT(*) as count 
                FROM stocks 
                GROUP BY board 
                ORDER BY count DESC
            `);
            return rows;
        } catch (error) {
            throw error;
        }
    }

    static async deleteByCode(code) {
        try {
            const db = await getPool();
            const [result] = await db.execute('DELETE FROM stocks WHERE code = ?', [code]);
            return result.affectedRows > 0;
        } catch (error) {
            throw error;
        }
    }

    // 新增：清理重复数据，保留最新的记录
    static async removeDuplicates() {
        try {
            const db = await getPool();
            console.log('开始清理重复数据...');
            
            // 查找重复的股票代码
            const [duplicates] = await db.execute(`
                SELECT code, COUNT(*) as count, MAX(id) as max_id
                FROM stocks 
                GROUP BY code 
                HAVING COUNT(*) > 1
            `);
            
            if (duplicates.length === 0) {
                console.log('没有发现重复数据');
                return 0;
            }
            
            console.log(`发现 ${duplicates.length} 个重复的股票代码`);
            
            let deletedCount = 0;
            for (const dup of duplicates) {
                // 删除除了最新记录之外的所有重复记录
                const [result] = await db.execute(`
                    DELETE FROM stocks 
                    WHERE code = ? AND id != ?
                `, [dup.code, dup.max_id]);
                
                deletedCount += result.affectedRows;
                console.log(`清理股票代码 ${dup.code} 的重复数据，删除了 ${result.affectedRows} 条记录`);
            }
            
            console.log(`重复数据清理完成，总共删除了 ${deletedCount} 条记录`);
            return deletedCount;
        } catch (error) {
            console.error('清理重复数据失败:', error);
            throw error;
        }
    }

    // 新增：获取数据库统计信息
    static async getDatabaseStats() {
        try {
            const db = await getPool();
            const [totalCount] = await db.execute('SELECT COUNT(*) as total FROM stocks');
            const [boardStats] = await db.execute(`
                SELECT board, COUNT(*) as count 
                FROM stocks 
                GROUP BY board 
                ORDER BY count DESC
            `);
            
            return {
                total: totalCount[0].total,
                byBoard: boardStats
            };
        } catch (error) {
            throw error;
        }
    }
}

export default Stock; 