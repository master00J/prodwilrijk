"""
Atlas Overzicht - Streamlit Applicatie v2.0
Geoptimaliseerde versie met modulaire architectuur.
"""

import streamlit as st
import pandas as pd
import sys
from pathlib import Path
from typing import Optional, Tuple
import io

# Setup paths
APP_DIR = Path(__file__).resolve().parent
REPO_DIR = APP_DIR.parent
if str(REPO_DIR) not in sys.path:
    sys.path.insert(0, str(REPO_DIR))

# Import configuration
from config import AppConfig

# Import utilities
from utils import (
    StateManager,
    CacheManager,
    DataValidator,
    MetricsCalculator
)

# Import components
from components import (
    render_executive_dashboard,
    render_transport_tab,
    render_forecast_tab,
    render_packed_tab,
    render_stock_analysis_tab,
    render_kanban_tab
)

# Import original functions (tijdelijk tot volledig gerefactord)
from scripts.build_overview import (
    build_overview,
    find_pils_csv,
    read_stock_files,
    read_erp,
    read_pils,
    sync_to_database,
)

# Initialize configuration
config = AppConfig.get_config()

# Page configuration
st.set_page_config(
    page_title=config.PAGE_TITLE,
    layout=config.PAGE_LAYOUT,
    initial_sidebar_state="expanded"
)

# Initialize managers
state_manager = StateManager(config.STATE_FILE)
cache_manager = CacheManager(config.REPO_DIR / "cache")

# Initialize session state
state_manager.init_session_state()


def load_and_validate_data(
    use_project_files: bool,
    pils_upload: Optional[io.BytesIO],
    erp_upload: Optional[io.BytesIO]
) -> Tuple[pd.DataFrame, pd.DataFrame, Path, Path, dict]:
    """
    Load and validate input data with improved error handling.
    
    Returns:
        Tuple of (df_pils, df_erp, pils_path, erp_path, validation_results)
    """
    validation_results = {}
    
    try:
        if use_project_files:
            # Load from project files
            pils_path = find_pils_csv(config.REPO_DIR)
            erp_path = config.REPO_DIR / "ERP link.xlsx"
            
            # Use caching for faster loads
            cache_key_pils = f"pils_{pils_path.stat().st_mtime}"
            cache_key_erp = f"erp_{erp_path.stat().st_mtime}"
            
            df_pils = cache_manager.get_cached_dataframe(cache_key_pils)
            if df_pils is None:
                df_pils = read_pils(pils_path)
                cache_manager.cache_dataframe(df_pils, cache_key_pils)
            
            df_erp = cache_manager.get_cached_dataframe(cache_key_erp)
            if df_erp is None:
                df_erp = read_erp(erp_path)
                cache_manager.cache_dataframe(df_erp, cache_key_erp)
        
        else:
            # Load from uploads
            if not pils_upload:
                raise ValueError("Geen PILS CSV geüpload")
            if not erp_upload:
                raise ValueError("Geen ERP Excel geüpload")
            
            # Read uploads
            pils_upload.seek(0)
            df_pils = pd.read_csv(pils_upload, sep=None, engine="python", dtype=str)
            
            erp_upload.seek(0)
            df_erp = pd.read_excel(erp_upload, dtype=str)
            
            # Create temp paths for compatibility
            pils_path = Path("uploaded_pils.csv")
            erp_path = Path("uploaded_erp.xlsx")
        
        # Validate data
        pils_valid, pils_errors, pils_warnings = DataValidator.validate_dataframe(df_pils, 'pils')
        erp_valid, erp_errors, erp_warnings = DataValidator.validate_dataframe(df_erp, 'erp')
        
        validation_results['pils'] = (pils_valid, pils_errors, pils_warnings)
        validation_results['erp'] = (erp_valid, erp_errors, erp_warnings)
        
        # Clean data
        df_pils = DataValidator.clean_dataframe(df_pils, 'pils')
        df_erp = DataValidator.clean_dataframe(df_erp, 'erp')
        
        # Show validation warnings if any
        if pils_warnings or erp_warnings:
            with st.expander("⚠️ Data Validatie Waarschuwingen", expanded=False):
                if pils_warnings:
                    st.warning("**PILS Waarschuwingen:**")
                    for warning_key, warning_data in pils_warnings.items():
                        if isinstance(warning_data, dict):
                            st.write(f"- {warning_data.get('message', warning_key)}")
                
                if erp_warnings:
                    st.warning("**ERP Waarschuwingen:**")
                    for warning_key, warning_data in erp_warnings.items():
                        if isinstance(warning_data, dict):
                            st.write(f"- {warning_data.get('message', warning_key)}")
        
        return df_pils, df_erp, pils_path, erp_path, validation_results
    
    except Exception as e:
        st.error(f"❌ Fout bij laden data: {str(e)}")
        raise


def main():
    """Main application function."""
    
    # Sidebar
    with st.sidebar:
        st.title("⚙️ Instellingen")
        
        # File selection
        st.subheader("📁 Bestanden")
        use_project_files = st.checkbox(
            "Gebruik projectbestanden",
            value=True,
            help="Gebruikt automatisch de nieuwste bestanden uit de projectmap"
        )
        
        uploaded_pils = None
        uploaded_erp = None
        if not use_project_files:
            uploaded_pils = st.file_uploader("PILS CSV", type=["csv"])
            uploaded_erp = st.file_uploader("ERP Excel", type=["xlsx"])
        
        # Dark mode toggle
        if config.ENABLE_DARK_MODE:
            dark_mode = st.checkbox("🌙 Dark Mode", value=False)
            if dark_mode:
                st.markdown("""
                <style>
                    .stApp {
                        background-color: #1e1e1e;
                        color: #ffffff;
                    }
                    .stSidebar {
                        background-color: #2d2d2d;
                    }
                </style>
                """, unsafe_allow_html=True)
        
        # Cache management
        st.subheader("💾 Cache")
        cache_stats = cache_manager.get_cache_stats()
        st.metric("Cache Size", f"{cache_stats['total_size_mb']:.1f} MB")
        st.metric("Cached Items", cache_stats['total_items'])
        
        if st.button("🗑️ Clear Cache"):
            cache_manager.clear_all_cache()
            st.success("Cache geleegd!")
            st.rerun()
        
        # Email Sync Status
        try:
            from components.email_sync_component import render_email_sync_status
            render_email_sync_status()
        except Exception as e:
            st.warning(f"Email sync niet beschikbaar: {e}")
        
        st.divider()
        
        # Info
        st.subheader("ℹ️ Info")
        st.info(f"""
        **Versie:** 2.0.0
        **State:** v{state_manager.VERSION}
        **Config:** {config.PAGE_TITLE}
        """)
    
    # Main content
    st.title("🏭 Atlas Copco – Overzicht en Transportbeheer")
    st.caption("Geoptimaliseerde versie met verbeterde performance en validatie")
    
    # Check if data is loaded
    if not state_manager.is_data_loaded():
        st.info("🚀 **Welkom!** Klik op 'Verwerken' om te beginnen.")
        st.caption("💡 De eerste keer laden kan 15-20 seconden duren. Daarna wordt data gecached.")
    else:
        last_refresh = state_manager.get_last_refresh()
        if last_refresh:
            st.success(f"✅ **Data geladen** - Laatste update: {last_refresh.strftime(config.DATETIME_FORMAT)}")
        
        # Auto-refresh suggestion
        if state_manager.should_refresh(max_age_minutes=60):
            st.info("💡 Data is meer dan een uur oud. Overweeg te vernieuwen.")
    
    # Process button
    col1, col2, col3 = st.columns([1, 1, 3])
    with col1:
        process = st.button("🔄 Verwerken", type="primary", use_container_width=True)
    with col2:
        if state_manager.is_data_loaded():
            if st.button("🔄 Vernieuwen", use_container_width=True):
                state_manager.clear_data()
                st.rerun()
    
    # Process data
    if process or not state_manager.is_data_loaded():
        try:
            # Progress tracking
            progress_bar = st.progress(0)
            status_text = st.empty()
            
            # Load data
            status_text.text("📁 Laden van bestanden...")
            progress_bar.progress(20)
            
            df_pils, df_erp, pils_path, erp_path, validation_results = load_and_validate_data(
                use_project_files,
                uploaded_pils,
                uploaded_erp
            )
            
            # Load stock
            status_text.text("📦 Verwerken van stock data...")
            progress_bar.progress(40)
            
            stock_dir = config.REPO_DIR / "Stock Files"
            df_stock = read_stock_files(stock_dir, df_erp, use_cache=True)
            
            # Load persistent state
            status_text.text("💾 Laden van opgeslagen data...")
            progress_bar.progress(60)
            
            persistent = state_manager.load_persistent_state()
            comments_persist = persistent.get("comments", {})
            status_persist = persistent.get("status_map", {})
            priorities_persist = persistent.get("priorities", {})
            
            # Build overview
            status_text.text("🔄 Bouwen van overzicht...")
            progress_bar.progress(80)
            
            overview, transport = build_overview(
                df_pils,
                df_erp,
                df_stock=df_stock,
                comments_map=state_manager.get("comments", comments_persist)
            )
            
            # Add status column
            if "status" not in overview.columns:
                overview.loc[:, "status"] = overview["case_label"].map(status_persist).fillna("")
            
            # Store in session state
            state_manager.update({
                "overview": overview,
                "transport": transport,
                "df_pils": df_pils,
                "df_erp": df_erp,
                "df_stock": df_stock,
                "comments": comments_persist,
                "status_map": status_persist,
                "priorities": priorities_persist
            })
            
            # Mark as loaded
            state_manager.mark_data_loaded()
            
            # Sync to database (background)
            try:
                sync_to_database(df_pils, df_erp, df_stock)
            except Exception:
                pass
            
            # Complete
            progress_bar.progress(100)
            status_text.text("✅ Data succesvol geladen!")
            
            # Clear progress
            import time
            time.sleep(0.5)
            progress_bar.empty()
            status_text.empty()
            
            # Show validation report if there were issues
            if validation_results:
                report = DataValidator.generate_validation_report(validation_results)
                with st.expander("📋 Validatie Rapport", expanded=False):
                    st.text(report)
            
        except Exception as e:
            progress_bar.empty()
            status_text.empty()
            st.error(f"❌ Fout bij verwerken: {str(e)}")
            st.exception(e)
            return
    
    # Display data if loaded
    if state_manager.is_data_loaded():
        overview = state_manager.get("overview")
        transport = state_manager.get("transport")
        
        if overview is None or transport is None:
            st.error("Data niet correct geladen. Probeer opnieuw.")
            return
        
        # KPIs
        metrics = MetricsCalculator.calculate_executive_metrics(overview, transport)
        
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Totaal Cases", f"{metrics['total_cases']:,}")
        col2.metric("In Willebroek", f"{metrics['in_willebroek']:,}")
        col3.metric("Transport Nodig", f"{metrics['total_transport_needed']:,}")
        col4.metric("Overdue", f"{metrics['backlog_overdue']}")
        
        # Tabs
        tab_names = [
            "📊 Executive Dashboard",
            "📋 Overzicht",
            "🚚 Transport",
            "📈 Forecast",
            "📦 Packed",
            "📊 Stock Analyse",
            "📦 Kanban Rekken",
            "⏰ Backlog"
        ]
        
        tabs = st.tabs(tab_names)
        
        with tabs[0]:
            # Executive Dashboard
            render_executive_dashboard(overview, transport)
        
        with tabs[1]:
            # Overview tab met uitgebreide functionaliteit
            st.header("📋 Overzicht - PILS Data")
            
            # Maak een kopie van overview om warnings te voorkomen
            overview = overview.copy()
            
            # Voeg priority kolom toe als die er nog niet is
            if "priority" not in overview.columns:
                priorities = state_manager.get("priorities", {})
                overview.loc[:, "priority"] = overview["case_label"].map(priorities).fillna(False)
            
            # Voeg comment kolom toe als die er nog niet is
            if "comment" not in overview.columns:
                comments = state_manager.get("comments", {})
                overview.loc[:, "comment"] = overview["case_label"].map(comments).fillna("")
            
            # Filters
            with st.expander("🔍 Filters", expanded=True):
                col1, col2, col3, col4, col5 = st.columns(5)
                
                with col1:
                    locations = ["Alle"] + sorted(overview["productielocatie"].dropna().unique().tolist())
                    sel_location = st.selectbox("Locatie", locations)
                
                with col2:
                    statuses = ["Alle"] + sorted([s for s in overview.get("status", pd.Series()).dropna().unique() if s])
                    sel_status = st.selectbox("Status", statuses)
                
                with col3:
                    willebroek_filter = st.selectbox(
                        "In Willebroek",
                        ["Alle", "Ja", "Nee"]
                    )
                
                with col4:
                    priority_filter = st.selectbox(
                        "⭐ Priority",
                        ["Alle", "Priority Only", "Non-Priority"]
                    )
                
                with col5:
                    search = st.text_input("🔍 Zoeken", placeholder="Case, type, item...")
            
            # Apply filters - gebruik .loc om warnings te voorkomen
            df_filtered = overview.copy()
            
            if sel_location != "Alle":
                df_filtered = df_filtered.loc[df_filtered["productielocatie"] == sel_location].copy()
            
            if sel_status != "Alle":
                df_filtered = df_filtered.loc[df_filtered["status"] == sel_status].copy()
            
            if willebroek_filter == "Ja":
                df_filtered = df_filtered.loc[df_filtered["in_willebroek"] == True].copy()
            elif willebroek_filter == "Nee":
                df_filtered = df_filtered.loc[df_filtered["in_willebroek"] == False].copy()
            
            if priority_filter == "Priority Only":
                df_filtered = df_filtered.loc[df_filtered["priority"] == True].copy()
            elif priority_filter == "Non-Priority":
                df_filtered = df_filtered.loc[df_filtered["priority"] == False].copy()
            
            if search:
                search_cols = ["case_label", "case_type", "item_number", "stock_location", "comment"]
                search_str = df_filtered[search_cols].astype(str).agg(" ".join, axis=1)
                df_filtered = df_filtered.loc[search_str.str.contains(search, case=False, na=False)].copy()
            
            # Display metrics
            col_m1, col_m2, col_m3 = st.columns(3)
            col_m1.write(f"**{len(df_filtered)} cases** (van {len(overview)} totaal)")
            priority_count = int(df_filtered["priority"].sum()) if "priority" in df_filtered.columns else 0
            col_m2.write(f"**⭐ {priority_count} priority cases**")
            with_comments = int((df_filtered["comment"] != "").sum()) if "comment" in df_filtered.columns else 0
            col_m3.write(f"**💬 {with_comments} met comments**")
            
            # Styling voor priority cases
            def highlight_priority(row):
                """Highlight priority rows met gouden kleur."""
                if row.get("priority", False):
                    return ['background-color: #FFD700; color: #000000; font-weight: bold'] * len(row)
                return [''] * len(row)
            
            # Selecteer kolommen om te tonen (reorganiseer voor betere weergave)
            display_columns = ["priority", "case_label", "case_type", "arrival_date", "item_number", 
                             "productielocatie", "in_willebroek", "status", "comment", "stock_location"]
            display_columns = [col for col in display_columns if col in df_filtered.columns]
            
            # Editable dataframe met styling
            st.markdown("""
            <style>
            /* Maak priority cases gouden */
            [data-testid="stDataFrameResizable"] tbody tr:has(input[type="checkbox"]:checked) {
                background-color: #FFD700 !important;
            }
            </style>
            """, unsafe_allow_html=True)
            
            edited_df = st.data_editor(
                df_filtered[display_columns],
                hide_index=True,
                use_container_width=True,
                num_rows="fixed",
                disabled=["case_label", "case_type", "arrival_date", "item_number", "productielocatie"],
                column_config={
                    "priority": st.column_config.CheckboxColumn(
                        "⭐",
                        help="Markeer als priority case",
                        default=False
                    ),
                    "in_willebroek": st.column_config.CheckboxColumn("In WB"),
                    "comment": st.column_config.TextColumn(
                        "💬 Comment",
                        help="Voeg notities toe",
                        max_chars=500
                    ),
                    "status": st.column_config.SelectboxColumn(
                        "Status",
                        options=config.VALID_STATUSES
                    ),
                    "arrival_date": st.column_config.DateColumn(
                        "Arrival Date",
                        format="DD/MM/YYYY"
                    )
                },
                key="overview_editor"
            )
            
            # Save changes
            col_save1, col_save2, col_save3 = st.columns([1, 1, 3])
            
            with col_save1:
                if st.button("💾 Opslaan", type="primary", use_container_width=True):
                    # Update alle gewijzigde data
                    current_comments = state_manager.get("comments", {})
                    current_status = state_manager.get("status_map", {})
                    current_priorities = state_manager.get("priorities", {})
                    
                    for idx, row in edited_df.iterrows():
                        case_label = row["case_label"]
                        
                        # Update priority
                        if "priority" in row:
                            current_priorities[case_label] = bool(row["priority"])
                        
                        # Update comment
                        if "comment" in row and row["comment"]:
                            current_comments[case_label] = str(row["comment"])
                        elif case_label in current_comments:
                            # Verwijder lege comments
                            del current_comments[case_label]
                        
                        # Update status
                        if "status" in row and row["status"]:
                            current_status[case_label] = row["status"]
                    
                    # Save to state
                    state_manager.set("comments", current_comments)
                    state_manager.set("status_map", current_status)
                    state_manager.set("priorities", current_priorities)
                    
                    # Save to disk
                    state_manager.save_persistent_state()
                    st.success("✅ Alle wijzigingen opgeslagen!")
                    st.rerun()
            
            with col_save2:
                if st.button("🔄 Refresh", use_container_width=True):
                    st.rerun()
            
            # Quick actions
            with st.expander("⚡ Quick Actions", expanded=False):
                col_qa1, col_qa2, col_qa3 = st.columns(3)
                
                with col_qa1:
                    if st.button("⭐ Markeer gefilterde als priority"):
                        current_priorities = state_manager.get("priorities", {})
                        for case in df_filtered["case_label"]:
                            current_priorities[case] = True
                        state_manager.set("priorities", current_priorities)
                        state_manager.save_persistent_state()
                        st.success(f"✅ {len(df_filtered)} cases gemarkeerd als priority")
                        st.rerun()
                
                with col_qa2:
                    if st.button("📝 Clear alle priority markeringen"):
                        state_manager.set("priorities", {})
                        state_manager.save_persistent_state()
                        st.success("✅ Alle priority markeringen verwijderd")
                        st.rerun()
                
                with col_qa3:
                    # Export gefilterde data
                    buffer = io.BytesIO()
                    with pd.ExcelWriter(buffer, engine='xlsxwriter') as writer:
                        df_filtered.to_excel(writer, sheet_name='Overview', index=False)
                    buffer.seek(0)
                    
                    st.download_button(
                        label="📥 Download gefilterde data",
                        data=buffer.getvalue(),
                        file_name=f"Overview_filtered_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
                        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    )
        
        with tabs[2]:
            # Transport tab
            transport_data = state_manager.get("transport")
            if transport_data is None:
                transport_data = pd.DataFrame()
            
            stock_data = state_manager.get("df_stock")
            if stock_data is None:
                stock_data = pd.DataFrame()
            
            render_transport_tab(
                transport=transport_data,
                overview=overview,
                df_stock=stock_data
            )
        
        with tabs[3]:
            # Forecast tab
            erp_data = state_manager.get("df_erp")
            if erp_data is None:
                erp_data = pd.DataFrame()
            
            stock_data_forecast = state_manager.get("df_stock")
            if stock_data_forecast is None:
                stock_data_forecast = pd.DataFrame()
            
            render_forecast_tab(
                overview=overview,
                df_erp=erp_data,
                df_stock=stock_data_forecast
            )
        
        with tabs[4]:
            # Packed tab
            render_packed_tab(
                repo_dir=config.REPO_DIR,
                state_manager=state_manager
            )
        
        with tabs[5]:
            # Stock Analyse tab
            render_stock_analysis_tab(repo_dir=config.REPO_DIR)
        
        with tabs[6]:
            # Kanban rekken indeling
            render_kanban_tab(repo_dir=config.REPO_DIR)

        with tabs[7]:
            # Backlog tab
            st.header("⏰ Backlog")
            st.write("Backlog op basis van arrival_date en verpakkingstermijn")
            
            df_bl = overview.copy()
            # Alleen rijen met geldige arrival_date
            if "arrival_date" in df_bl.columns:
                df_bl = df_bl[pd.notna(df_bl["arrival_date"])].copy()
            else:
                df_bl = pd.DataFrame(columns=["case_label", "case_type", "arrival_date", "productielocatie"])
            
            # Bepaal termijn in werkdagen volgens specifieke regels
            def _term_for(ct: str) -> int:
                s = str(ct or "").strip().upper()
                
                if s.startswith("C"):
                    number_str = s[1:].strip()
                    try:
                        number = int(number_str)
                        if 100 <= number <= 998:
                            return 1  # C kisten 100-998: 1 dag
                        elif number == 999:
                            return 10  # C kisten 999: 10 dagen
                    except (ValueError, IndexError):
                        pass
                    return 0
                
                elif s.startswith("K"):
                    number_str = s[1:].strip()
                    try:
                        number = int(number_str)
                        if 1 <= number <= 99:
                            return 10  # K kisten 1-99: 10 dagen
                        elif 100 <= number <= 999:
                            return 3   # K kisten 100-999: 3 dagen
                    except (ValueError, IndexError):
                        pass
                    return 0
                
                return 0
            
            df_bl["term_werkdagen"] = df_bl["case_type"].map(_term_for).astype(int)
            
            # Helper: tel werkdagen op bij een datum
            def _add_business_days(start: pd.Timestamp, days: int) -> pd.Timestamp:
                d = pd.to_datetime(start, errors="coerce")
                if pd.isna(d) or days <= 0:
                    return d
                count = 0
                while count < days:
                    d += pd.Timedelta(days=1)
                    if d.weekday() < 5:  # ma-vr
                        count += 1
                return d
            
            df_bl["deadline"] = df_bl.apply(lambda r: _add_business_days(r.get("arrival_date"), int(r.get("term_werkdagen", 0))), axis=1)
            today = pd.Timestamp.today().normalize()
            df_bl["dagen_te_laat"] = (today - pd.to_datetime(df_bl["deadline"], errors="coerce")).dt.days
            
            # Bereken dagen in Willebroek (PAC3PL)
            df_bl["dagen_in_willebroek"] = 0
            if "locatie" in df_bl.columns:
                # Als case in Willebroek staat, bereken dagen sinds arrival_date
                mask_in_wlb = df_bl["locatie"].str.upper() == "PAC3PL"
                df_bl.loc[mask_in_wlb, "dagen_in_willebroek"] = (
                    today - pd.to_datetime(df_bl.loc[mask_in_wlb, "arrival_date"], errors="coerce")
                ).dt.days
            
            df_bl = df_bl[df_bl["dagen_te_laat"] > 0].copy()
            
            # Sluit reeds gepackte cases uit adhv archief
            try:
                from scripts.build_overview import load_packed_archive
                packed_hist = load_packed_archive()
                if not packed_hist.empty and "case_label" in packed_hist.columns:
                    already_packed = set(packed_hist["case_label"].astype(str).str.strip().tolist())
                    df_bl = df_bl[~df_bl["case_label"].astype(str).str.strip().isin(already_packed)]
            except Exception:
                pass
            
            # UI: metrics
            c1, c2, c3 = st.columns(3)
            
            k_cases_with_deadline = 0
            c_cases_with_deadline = 0
            
            for _, row in df_bl.iterrows():
                case_type = str(row.get("case_type", "")).strip().upper()
                
                if case_type.startswith("K"):
                    number_str = case_type[1:].strip()
                    try:
                        number = int(number_str)
                        if 1 <= number <= 99 or 100 <= number <= 999:
                            k_cases_with_deadline += 1
                    except (ValueError, IndexError):
                        pass
                elif case_type.startswith("C"):
                    number_str = case_type[1:].strip()
                    try:
                        number = int(number_str)
                        if 100 <= number <= 998 or number == 999:
                            c_cases_with_deadline += 1
                    except (ValueError, IndexError):
                        pass
            
            with c1:
                st.metric("Backlog K", k_cases_with_deadline)
                st.caption("K1-99 (10d), K100-999 (3d)")
            with c2:
                st.metric("Backlog C", c_cases_with_deadline)
                st.caption("C100-998 (1d), C999 (10d)")
            with c3:
                st.metric("Total Overdue", len(df_bl))
            
            # Zoekfunctie
            search_bl = st.text_input("🔍 Zoek case_label of case_type", key="search_backlog")
            
            if search_bl:
                df_bl = df_bl[
                    df_bl["case_label"].astype(str).str.contains(search_bl, case=False, na=False) |
                    df_bl["case_type"].astype(str).str.contains(search_bl, case=False, na=False)
                ]
            
            # Sorteer op dagen te laat (meest urgent eerst)
            df_bl = df_bl.sort_values("dagen_te_laat", ascending=False)
            
            # Toon tabel met dagen in Willebroek
            display_cols = ["case_label", "case_type", "arrival_date", "deadline", "dagen_te_laat", "dagen_in_willebroek", "locatie", "productielocatie"]
            display_cols = [c for c in display_cols if c in df_bl.columns]
            
            st.dataframe(
                df_bl[display_cols],
                use_container_width=True,
                hide_index=True,
                column_config={
                    "case_label": st.column_config.TextColumn("Case Label", width="medium"),
                    "case_type": st.column_config.TextColumn("Type", width="small"),
                    "arrival_date": st.column_config.DateColumn("Arrival", format="DD/MM/YYYY"),
                    "deadline": st.column_config.DateColumn("Deadline", format="DD/MM/YYYY"),
                    "dagen_te_laat": st.column_config.NumberColumn("Dagen Te Laat", format="%d"),
                    "dagen_in_willebroek": st.column_config.NumberColumn("Dagen in WLB", format="%d", help="Aantal dagen dat case in Willebroek (PAC3PL) staat"),
                    "locatie": st.column_config.TextColumn("Locatie", width="small"),
                    "productielocatie": st.column_config.TextColumn("Productie", width="small")
                }
            )
            
            # Download button
            if not df_bl.empty:
                buffer = io.BytesIO()
                with pd.ExcelWriter(buffer, engine='xlsxwriter') as writer:
                    df_bl[display_cols].to_excel(writer, index=False, sheet_name='Backlog')
                
                st.download_button(
                    label="📥 Download Backlog",
                    data=buffer.getvalue(),
                    file_name=f"Backlog_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )


if __name__ == "__main__":
    main()
