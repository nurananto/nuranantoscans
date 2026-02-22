// ============================================
// SCRIPT CONSOLE: CEK CSS TOMBOL BATAL
// ============================================
// Copy paste script ini ke Console browser untuk cek styling tombol BATAL
// di Edit Profile Modal

(function checkBatalButton() {
    console.log('🔍 ============================================');
    console.log('🔍 CEK CSS TOMBOL BATAL - EDIT PROFILE MODAL');
    console.log('🔍 ============================================\n');
    
    // Cari tombol BATAL
    const btnBatal = document.getElementById('btnCancelEdit');
    
    if (!btnBatal) {
        console.error('❌ Tombol BATAL tidak ditemukan!');
        console.log('💡 Pastikan Edit Profile Modal sudah dibuka');
        return;
    }
    
    console.log('✅ Tombol BATAL ditemukan!\n');
    
    // Get computed styles
    const styles = window.getComputedStyle(btnBatal);
    
    // CSS Properties yang penting
    const cssProps = {
        'text-align': styles.textAlign,
        'text-transform': styles.textTransform,
        'letter-spacing': styles.letterSpacing,
        'width': styles.width,
        'max-width': styles.maxWidth,
        'padding': styles.padding,
        'font-size': styles.fontSize,
        'font-weight': styles.fontWeight,
        'background': styles.background,
        'border': styles.border,
        'border-radius': styles.borderRadius,
        'cursor': styles.cursor,
        'position': styles.position,
        'z-index': styles.zIndex,
        'display': styles.display
    };
    
    console.log('📊 CSS PROPERTIES:');
    console.log('─'.repeat(50));
    
    // Cek properties penting
    const checks = {
        '✅ text-align: center': cssProps['text-align'] === 'center',
        '✅ text-transform: uppercase': cssProps['text-transform'] === 'uppercase',
        '✅ letter-spacing: 0.5px': parseFloat(cssProps['letter-spacing']) >= 0.5,
        '✅ max-width: 400px': parseFloat(cssProps['max-width']) === 400,
        '✅ position: relative': cssProps['position'] === 'relative',
        '✅ z-index: 1': cssProps['z-index'] === '1',
        '✅ cursor: pointer': cssProps['cursor'] === 'pointer'
    };
    
    // Tampilkan semua properties
    Object.entries(cssProps).forEach(([prop, value]) => {
        console.log(`${prop.padEnd(20)}: ${value}`);
    });
    
    console.log('\n' + '─'.repeat(50));
    console.log('🎯 VALIDASI:');
    console.log('─'.repeat(50));
    
    // Tampilkan hasil cek
    Object.entries(checks).forEach(([check, passed]) => {
        const icon = passed ? '✅' : '❌';
        const status = passed ? 'OK' : 'FAILED';
        console.log(`${icon} ${check.replace('✅ ', '').padEnd(30)} [${status}]`);
    });
    
    // Tampilkan teks tombol
    console.log('\n' + '─'.repeat(50));
    console.log('📝 TEKS TOMBOL:');
    console.log('─'.repeat(50));
    console.log(`Text Content: "${btnBatal.textContent}"`);
    console.log(`Inner Text: "${btnBatal.innerText}"`);
    
    // Cek parent container
    console.log('\n' + '─'.repeat(50));
    console.log('📦 PARENT CONTAINER:');
    console.log('─'.repeat(50));
    
    const parent = btnBatal.parentElement;
    if (parent) {
        const parentStyles = window.getComputedStyle(parent);
        console.log(`Parent Class: ${parent.className}`);
        console.log(`Parent Display: ${parentStyles.display}`);
        console.log(`Parent Align Items: ${parentStyles.alignItems}`);
        console.log(`Parent Justify Content: ${parentStyles.justifyContent}`);
    }
    
    // Summary
    const allPassed = Object.values(checks).every(v => v);
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
        console.log('🎉 SEMUA CEK PASSED! Tombol BATAL styling sudah benar!');
    } else {
        console.log('⚠️ ADA MASALAH! Beberapa styling tidak sesuai.');
        console.log('💡 Coba hard refresh: Ctrl + Shift + R');
    }
    console.log('='.repeat(50));
    
    // Return object untuk inspection lebih lanjut
    return {
        element: btnBatal,
        styles: cssProps,
        checks: checks,
        allPassed: allPassed
    };
})();
